"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/session";
import { getOpenShift, getShiftSummary } from "@/lib/cash";
import { refreshAutoStop, round3 } from "@/lib/stock";
import { UNITS } from "@/lib/constants";
import { int, oneOf, optStr, reqStr, run, ValidationError } from "@/lib/validate";

function refresh() {
  // значок «мало на складе» в боковом меню живёт в общем layout
  revalidatePath("/", "layout");
  revalidatePath("/stock");
  revalidatePath("/menu");
  revalidatePath("/hall");
}

/** Количество продукта: > 0, не больше 100 000, до 3 знаков после запятой. */
function qty(v: unknown, { allowZero = false } = {}) {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || (!allowZero && n === 0) || n > 100_000) throw new ValidationError("badQty");
  return round3(n);
}

// ---------- Продукты (владелец) ----------

export async function saveIngredient(input: {
  id?: number;
  nameRu: string;
  nameTg: string;
  unit: string;
  minStock: number;
  lastPrice: number;
  initialStock?: number;
}) {
  return run(async () => {
    const s = await requireSession(["OWNER"]);
    const data = {
      nameRu: reqStr(input.nameRu, 60),
      nameTg: reqStr(input.nameTg, 60),
      unit: oneOf(input.unit, UNITS),
      minStock: qty(input.minStock, { allowZero: true }),
      lastPrice: int(input.lastPrice, { min: 0 }),
    };
    if (input.id) {
      await db.$transaction(async (tx) => {
        await tx.ingredient.update({ where: { id: int(input.id, { min: 1 }) }, data });
        await refreshAutoStop(tx, [input.id!]);
      });
      await audit(s.uid, "INGREDIENT_UPDATED", "Ingredient", input.id, data);
    } else {
      const initial = input.initialStock ? qty(input.initialStock) : 0;
      const ing = await db.$transaction(async (tx) => {
        const created = await tx.ingredient.create({ data: { ...data, stock: initial } });
        if (initial > 0) {
          await tx.stockMovement.create({
            data: { ingredientId: created.id, type: "INVENTORY", qty: initial, price: data.lastPrice, reason: "Начальный остаток", createdById: s.uid },
          });
        }
        return created;
      });
      await audit(s.uid, "INGREDIENT_CREATED", "Ingredient", ing.id, { ...data, initial });
    }
    refresh();
  });
}

export async function archiveIngredient(id: number) {
  return run(async () => {
    const s = await requireSession(["OWNER"]);
    const used = await db.recipeItem.count({ where: { ingredientId: int(id, { min: 1 }), dish: { active: true } } });
    if (used) throw new ValidationError("ingredientInUse");
    const ing = await db.ingredient.update({ where: { id }, data: { active: false } });
    await audit(s.uid, "INGREDIENT_ARCHIVED", "Ingredient", id, { name: ing.nameRu });
    refresh();
  });
}

// ---------- Техкарты (владелец) ----------

export async function saveRecipe(dishId: number, items: { ingredientId: number; qty: number }[]) {
  return run(async () => {
    const s = await requireSession(["OWNER"]);
    const id = int(dishId, { min: 1 });
    if (!Array.isArray(items) || items.length > 30) throw new ValidationError("badValue");
    const clean = items.map((i) => ({ ingredientId: int(i.ingredientId, { min: 1 }), qty: qty(i.qty) }));
    if (new Set(clean.map((c) => c.ingredientId)).size !== clean.length) throw new ValidationError("duplicateIngredient");

    await db.$transaction(async (tx) => {
      const dish = await tx.dish.findUnique({ where: { id } });
      if (!dish) throw new ValidationError("notFound");
      const before = await tx.recipeItem.findMany({ where: { dishId: id }, select: { ingredientId: true } });
      await tx.recipeItem.deleteMany({ where: { dishId: id } });
      if (clean.length) await tx.recipeItem.createMany({ data: clean.map((c) => ({ dishId: id, ...c })) });
      await refreshAutoStop(tx, [...new Set([...before.map((b) => b.ingredientId), ...clean.map((c) => c.ingredientId)])]);
    });
    await audit(s.uid, "RECIPE_SAVED", "Dish", id, { items: clean });
    refresh();
  });
}

// ---------- Приход товара (кассир и владелец) ----------

export async function createReceipt(input: {
  supplierId?: number | null;
  supplierName?: string | null;
  date?: string | null;
  comment?: string | null;
  paidFromCash?: boolean;
  items: { ingredientId: number; qty: number; price: number }[];
}) {
  return run(async () => {
    const s = await requireSession();
    if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 50) throw new ValidationError("receiptEmpty");
    const items = input.items.map((i) => ({ ingredientId: int(i.ingredientId, { min: 1 }), qty: qty(i.qty), price: int(i.price, { min: 0 }) }));
    const total = items.reduce((sum, i) => sum + Math.round(i.qty * i.price), 0);
    const date = input.date ? new Date(input.date) : new Date();
    if (isNaN(date.getTime()) || date.getTime() > Date.now() + 86_400_000) throw new ValidationError("badDate");
    const comment = optStr(input.comment, 200);

    const result = await db.$transaction(async (tx) => {
      // поставщик: выбранный или новый по имени
      let supplierId = input.supplierId ? int(input.supplierId, { min: 1 }) : null;
      const newName = optStr(input.supplierName, 80);
      if (!supplierId && newName) {
        const existing = await tx.supplier.findFirst({ where: { name: newName } });
        supplierId = (existing ?? (await tx.supplier.create({ data: { name: newName } }))).id;
      }

      const receipt = await tx.stockReceipt.create({ data: { supplierId, date, total, comment, createdById: s.uid } });
      for (const i of items) {
        const ing = await tx.ingredient.findFirst({ where: { id: i.ingredientId, active: true } });
        if (!ing) throw new ValidationError("notFound");
        await tx.ingredient.update({
          where: { id: ing.id },
          // себестоимость считается по последней цене закупки
          data: { stock: round3(ing.stock + i.qty), lastPrice: i.price },
        });
        await tx.stockMovement.create({
          data: { ingredientId: ing.id, type: "RECEIPT", qty: i.qty, price: i.price, receiptId: receipt.id, createdById: s.uid },
        });
      }

      // оплатили из кассы — это расход смены (иначе наличные не сойдутся)
      if (input.paidFromCash && total > 0) {
        const shift = await getOpenShift(tx);
        if (!shift) throw new ValidationError("noShift");
        const sum = await getShiftSummary(shift.id, tx);
        if (total > sum.expectedCash) throw new ValidationError("notEnoughCash");
        const op = await tx.cashOperation.create({
          data: { cashShiftId: shift.id, type: "EXPENSE", amount: total, category: "PURCHASE", comment: `Приход №${receipt.id}`, createdById: s.uid },
        });
        await tx.expense.create({ data: { category: "PURCHASE", amount: total, comment: `Приход №${receipt.id}`, cashOperationId: op.id, createdById: s.uid } });
      }

      const stock = await refreshAutoStop(tx, items.map((i) => i.ingredientId));
      return { receipt, stock };
    });

    await audit(s.uid, "STOCK_RECEIPT", "StockReceipt", result.receipt.id, { total, items, paidFromCash: !!input.paidFromCash });
    if (result.stock.resumed.length) await audit(s.uid, "DISH_AUTO_RESUMED", "Dish", null, { dishes: result.stock.resumed });
    refresh();
    revalidatePath("/cash");
    return { id: result.receipt.id, total, resumed: result.stock.resumed };
  });
}

// ---------- Списание и инвентаризация (владелец) ----------

export async function writeOff(input: { ingredientId: number; qty: number; reason: string }) {
  return run(async () => {
    const s = await requireSession(["OWNER"]);
    const q = qty(input.qty);
    const reason = reqStr(input.reason, 200);
    const res = await db.$transaction(async (tx) => {
      const ing = await tx.ingredient.findFirst({ where: { id: int(input.ingredientId, { min: 1 }), active: true } });
      if (!ing) throw new ValidationError("notFound");
      if (q > ing.stock + 1e-9) throw new ValidationError("writeOffTooMuch");
      await tx.ingredient.update({ where: { id: ing.id }, data: { stock: round3(ing.stock - q) } });
      await tx.stockMovement.create({ data: { ingredientId: ing.id, type: "WRITE_OFF", qty: -q, price: ing.lastPrice, reason, createdById: s.uid } });
      await refreshAutoStop(tx, [ing.id]);
      return { name: ing.nameRu, loss: Math.round(q * ing.lastPrice) };
    });
    await audit(s.uid, "STOCK_WRITE_OFF", "Ingredient", input.ingredientId, { ...res, qty: q, reason });
    refresh();
  });
}

/** Инвентаризация: фактические остатки → движение на разницу по каждому изменившемуся продукту. */
export async function applyInventory(counts: { ingredientId: number; actual: number }[]) {
  return run(async () => {
    const s = await requireSession(["OWNER"]);
    if (!Array.isArray(counts) || counts.length === 0) throw new ValidationError("inventoryEmpty");
    const clean = counts.map((c) => ({ ingredientId: int(c.ingredientId, { min: 1 }), actual: qty(c.actual, { allowZero: true }) }));

    const diffs = await db.$transaction(async (tx) => {
      const out: { name: string; system: number; actual: number; diff: number; value: number }[] = [];
      for (const c of clean) {
        const ing = await tx.ingredient.findUnique({ where: { id: c.ingredientId } });
        if (!ing) throw new ValidationError("notFound");
        const diff = round3(c.actual - ing.stock);
        if (diff === 0) continue;
        await tx.ingredient.update({ where: { id: ing.id }, data: { stock: c.actual } });
        await tx.stockMovement.create({ data: { ingredientId: ing.id, type: "INVENTORY", qty: diff, price: ing.lastPrice, reason: "Инвентаризация", createdById: s.uid } });
        out.push({ name: ing.nameRu, system: ing.stock, actual: c.actual, diff, value: Math.round(diff * ing.lastPrice) });
      }
      await refreshAutoStop(tx, clean.map((c) => c.ingredientId));
      return out;
    });
    await audit(s.uid, "STOCK_INVENTORY", "Ingredient", null, { diffs });
    refresh();
    return { changed: diffs.length, value: diffs.reduce((sum, d) => sum + d.value, 0) };
  });
}
