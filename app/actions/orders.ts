"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSession, type Session } from "@/lib/session";
import { getOpenShift } from "@/lib/cash";
import { computeTotals, FREE_REMOVE_MINUTES } from "@/lib/orders";
import { ORDER_TYPES, PAYMENT_METHODS } from "@/lib/constants";
import { int, oneOf, optStr, reqStr, run, ValidationError } from "@/lib/validate";

type Tx = Prisma.TransactionClient;

function refresh(orderId?: number) {
  revalidatePath("/hall");
  revalidatePath("/orders");
  if (orderId) revalidatePath(`/orders/${orderId}`);
}

/** Пересчитать и сохранить суммы заказа после любого изменения. */
async function recalc(tx: Tx, orderId: number) {
  const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  const t = computeTotals(o);
  return tx.order.update({
    where: { id: orderId },
    data: {
      subtotal: t.subtotal,
      discountAmount: t.discountAmount,
      serviceAmount: t.serviceAmount,
      total: t.total,
      prepaymentApplied: t.prepaymentApplied,
    },
  });
}

/** Заказ, который ещё можно менять (не оплачен и не отменён). */
async function editableOrder(tx: Tx, orderId: number) {
  const o = await tx.order.findUnique({ where: { id: int(orderId, { min: 1 }) } });
  if (!o) throw new ValidationError("notFound");
  if (o.status === "PAID") throw new ValidationError("orderPaid");
  if (o.status === "CANCELLED") throw new ValidationError("orderCancelled");
  return o;
}

/** Любое изменение счёта возвращает заказ из «ждёт оплаты» в «открыт». */
async function reopenIfBill(tx: Tx, orderId: number) {
  await tx.order.updateMany({ where: { id: orderId, status: "BILL" }, data: { status: "OPEN" } });
}

async function isOwnerPin(pin: string | undefined) {
  if (!pin || !/^\d{4}$/.test(pin)) return false;
  const owners = await db.user.findMany({ where: { role: "OWNER", active: true } });
  for (const u of owners) if (await bcrypt.compare(pin, u.pinHash)) return true;
  return false;
}

// ---------- Создание ----------

export async function createOrder(input: { type: string; tableId?: number | null; waiterId?: number | null; guests?: number | null }) {
  return run(async () => {
    const s = await requireSession();
    const type = oneOf(input.type, ORDER_TYPES);
    if (!(await getOpenShift())) throw new ValidationError("noShift");
    const tableId = type === "DINE_IN" ? int(input.tableId, { min: 1 }) : null;
    const waiterId = input.waiterId ? int(input.waiterId, { min: 1 }) : null;
    const guests = input.guests ? int(input.guests, { min: 1, max: 200 }) : null;

    const order = await db.$transaction(async (tx) => {
      if (tableId) {
        const table = await tx.diningTable.findFirst({ where: { id: tableId, active: true } });
        if (!table) throw new ValidationError("notFound");
        // за столом уже есть открытый заказ — возвращаем его, а не создаём второй
        const existing = await tx.order.findFirst({ where: { tableId, status: { in: ["OPEN", "BILL"] } } });
        if (existing) return existing;
      }
      const settings = await tx.setting.findUnique({ where: { id: 1 } });
      const last = await tx.order.aggregate({ _max: { number: true } });
      return tx.order.create({
        data: {
          number: (last._max.number ?? 1000) + 1,
          type,
          tableId,
          waiterId,
          guests,
          serviceChargeBp: type === "DINE_IN" ? (settings?.serviceChargeBp ?? 0) : 0,
          createdById: s.uid,
        },
      });
    });
    await audit(s.uid, "ORDER_CREATED", "Order", order.id, { number: order.number, type, tableId });
    refresh();
    return { id: order.id };
  });
}

// ---------- Блюда ----------

export async function addItem(orderId: number, dishId: number, qty = 1) {
  return run(async () => {
    const s = await requireSession();
    await db.$transaction(async (tx) => {
      const o = await editableOrder(tx, orderId);
      const dish = await tx.dish.findFirst({ where: { id: int(dishId, { min: 1 }), active: true } });
      if (!dish) throw new ValidationError("notFound");
      if (dish.inStopList) throw new ValidationError("dishStopped");
      const n = int(qty, { min: 1, max: 99 });
      // то же блюдо без комментария — увеличиваем количество, а не плодим строки
      const same = await tx.orderItem.findFirst({ where: { orderId: o.id, dishId: dish.id, removed: false, comment: null } });
      if (same) await tx.orderItem.update({ where: { id: same.id }, data: { qty: same.qty + n } });
      else await tx.orderItem.create({ data: { orderId: o.id, dishId: dish.id, qty: n, price: dish.price } });
      await reopenIfBill(tx, o.id);
      await recalc(tx, o.id);
    });
    await audit(s.uid, "ORDER_ITEM_ADDED", "Order", orderId, { dishId, qty });
    refresh(orderId);
  });
}

/**
 * Убрать блюдо (или часть порций). В первые 5 минут — без причины (исправление ошибки ввода),
 * позже — только с причиной, она попадает в журнал.
 */
export async function removeItem(itemId: number, qty: number, reason?: string) {
  return run(async () => {
    const s = await requireSession();
    const item = await db.orderItem.findUnique({ where: { id: int(itemId, { min: 1 }) }, include: { dish: true } });
    if (!item || item.removed) throw new ValidationError("notFound");
    const n = int(qty, { min: 1, max: item.qty });
    const fresh = Date.now() - item.createdAt.getTime() < FREE_REMOVE_MINUTES * 60_000;
    const why = optStr(reason, 200);
    if (!fresh && !why) throw new ValidationError("reasonRequired");

    await db.$transaction(async (tx) => {
      await editableOrder(tx, item.orderId);
      if (n === item.qty) {
        await tx.orderItem.update({ where: { id: item.id }, data: { removed: true, removedReason: why ?? "mistake" } });
      } else {
        await tx.orderItem.update({ where: { id: item.id }, data: { qty: item.qty - n } });
        // убранные порции сохраняем отдельной строкой — для отчёта об отказах
        await tx.orderItem.create({
          data: { orderId: item.orderId, dishId: item.dishId, qty: n, price: item.price, removed: true, removedReason: why ?? "mistake", comment: item.comment },
        });
      }
      await reopenIfBill(tx, item.orderId);
      await recalc(tx, item.orderId);
    });
    await audit(s.uid, "ORDER_ITEM_REMOVED", "Order", item.orderId, { dish: item.dish.nameRu, qty: n, reason: why ?? "mistake", fresh });
    refresh(item.orderId);
  });
}

export async function setItemComment(itemId: number, comment: string) {
  return run(async () => {
    await requireSession();
    const item = await db.orderItem.findUnique({ where: { id: int(itemId, { min: 1 }) } });
    if (!item || item.removed) throw new ValidationError("notFound");
    await db.$transaction(async (tx) => {
      await editableOrder(tx, item.orderId);
      await tx.orderItem.update({ where: { id: item.id }, data: { comment: optStr(comment, 120) } });
    });
    refresh(item.orderId);
  });
}

// ---------- Параметры заказа ----------

export async function updateOrderInfo(orderId: number, input: { waiterId?: number | null; guests?: number | null; comment?: string | null }) {
  return run(async () => {
    const s = await requireSession();
    await db.$transaction(async (tx) => {
      const o = await editableOrder(tx, orderId);
      await tx.order.update({
        where: { id: o.id },
        data: {
          ...(input.waiterId !== undefined ? { waiterId: input.waiterId ? int(input.waiterId, { min: 1 }) : null } : {}),
          ...(input.guests !== undefined ? { guests: input.guests ? int(input.guests, { min: 1, max: 200 }) : null } : {}),
          ...(input.comment !== undefined ? { comment: optStr(input.comment, 300) } : {}),
        },
      });
    });
    await audit(s.uid, "ORDER_UPDATED", "Order", orderId, input);
    refresh(orderId);
  });
}

/** Перенести заказ на другой (свободный) стол. */
export async function moveOrder(orderId: number, tableId: number) {
  return run(async () => {
    const s = await requireSession();
    const from = await db.$transaction(async (tx) => {
      const o = await editableOrder(tx, orderId);
      if (o.type !== "DINE_IN") throw new ValidationError("badValue");
      const table = await tx.diningTable.findFirst({ where: { id: int(tableId, { min: 1 }), active: true } });
      if (!table) throw new ValidationError("notFound");
      const busy = await tx.order.count({ where: { tableId: table.id, status: { in: ["OPEN", "BILL"] }, id: { not: o.id } } });
      if (busy) throw new ValidationError("tableBusy");
      await tx.order.update({ where: { id: o.id }, data: { tableId: table.id } });
      return o.tableId;
    });
    await audit(s.uid, "ORDER_MOVED", "Order", orderId, { fromTableId: from, toTableId: tableId });
    refresh(orderId);
  });
}

/** Скидка на весь заказ. Кассиру — только с пин-кодом владельца. */
export async function setDiscount(
  orderId: number,
  input: { type: "PERCENT" | "AMOUNT" | null; value: number; reason?: string; ownerPin?: string },
) {
  return run(async () => {
    const s = await requireSession();
    if (s.role !== "OWNER" && !(await isOwnerPin(input.ownerPin))) throw new ValidationError("ownerPinRequired");
    const type = input.type ? oneOf(input.type, ["PERCENT", "AMOUNT"] as const) : null;
    const value = type ? int(input.value, { min: 1, max: type === "PERCENT" ? 10000 : 100_000_000 }) : 0;
    const reason = type ? reqStr(input.reason, 200) : null;
    await db.$transaction(async (tx) => {
      const o = await editableOrder(tx, orderId);
      await tx.order.update({ where: { id: o.id }, data: { discountType: type, discountValue: value, discountReason: reason } });
      await reopenIfBill(tx, o.id);
      await recalc(tx, o.id);
    });
    await audit(s.uid, type ? "ORDER_DISCOUNT_SET" : "ORDER_DISCOUNT_REMOVED", "Order", orderId, {
      type,
      value,
      reason,
      approvedBy: s.role === "OWNER" ? "owner" : "owner-pin",
    });
    refresh(orderId);
  });
}

/** Гость попросил счёт — стол на схеме становится «ждёт оплаты». */
export async function requestBill(orderId: number) {
  return run(async () => {
    const s = await requireSession();
    await db.$transaction(async (tx) => {
      const o = await editableOrder(tx, orderId);
      const items = await tx.orderItem.count({ where: { orderId: o.id, removed: false } });
      if (!items) throw new ValidationError("orderEmpty");
      await tx.order.update({ where: { id: o.id }, data: { status: "BILL" } });
    });
    await audit(s.uid, "ORDER_BILL", "Order", orderId);
    refresh(orderId);
  });
}

// ---------- Оплата ----------

export type PaymentInput = { method: string; amount: number; received?: number | null; provider?: string | null };

/**
 * Оплата заказа, можно несколькими способами. Сумма частей должна точно равняться остатку к оплате.
 * Для наличных можно указать, сколько дал гость, — сдача = received − amount.
 */
export async function payOrder(orderId: number, payments: PaymentInput[]) {
  return run(async () => {
    const s = await requireSession();
    if (!Array.isArray(payments) || payments.length === 0 || payments.length > 6) throw new ValidationError("badValue");
    const lines = payments.map((p) => {
      const method = oneOf(p.method, PAYMENT_METHODS);
      const amount = int(p.amount, { min: 1 });
      const received = method === "CASH" && p.received ? int(p.received, { min: amount }) : null;
      return { method, amount, received, provider: method === "TRANSFER" ? optStr(p.provider, 40) : null };
    });

    const result = await db.$transaction(async (tx) => {
      const shift = await getOpenShift(tx);
      if (!shift) throw new ValidationError("noShift");
      const o = await editableOrder(tx, orderId);
      const updated = await recalc(tx, o.id);
      const items = await tx.orderItem.count({ where: { orderId: o.id, removed: false } });
      if (!items) throw new ValidationError("orderEmpty");
      const due = updated.total - updated.prepaymentApplied;
      const paid = lines.reduce((sum, l) => sum + l.amount, 0);
      if (paid !== due) throw new ValidationError("paymentMismatch");

      await tx.payment.createMany({ data: lines.map((l) => ({ orderId: o.id, ...l })) });
      // Этап 3: здесь же — списание продуктов по техкартам и себестоимость
      return tx.order.update({ where: { id: o.id }, data: { status: "PAID", paidAt: new Date(), cashShiftId: shift.id } });
    });

    const change = lines.reduce((sum, l) => sum + (l.received ? l.received - l.amount : 0), 0);
    await audit(s.uid, "ORDER_PAID", "Order", orderId, { number: result.number, total: result.total, payments: lines, change });
    refresh(orderId);
    revalidatePath("/cash");
    return { change };
  });
}

// ---------- Отмена ----------

/**
 * Отменить заказ. Неоплаченный — кассир или владелец, с причиной.
 * Оплаченный — только владелец (деньги возвращаются гостю, в выручку не идёт).
 */
export async function cancelOrder(orderId: number, reason: string) {
  return run(async () => {
    const s: Session = await requireSession();
    const why = reqStr(reason, 200);
    const o = await db.order.findUnique({ where: { id: int(orderId, { min: 1 }) } });
    if (!o) throw new ValidationError("notFound");
    if (o.status === "CANCELLED") throw new ValidationError("orderCancelled");
    if (o.status === "PAID" && s.role !== "OWNER") throw new ValidationError("ownerOnly");
    await db.order.update({ where: { id: o.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: why } });
    await audit(s.uid, o.status === "PAID" ? "ORDER_PAID_CANCELLED" : "ORDER_CANCELLED", "Order", o.id, {
      number: o.number,
      total: o.total,
      reason: why,
    });
    refresh(o.id);
    revalidatePath("/cash");
  });
}
