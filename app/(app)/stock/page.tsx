import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { dishCost, marginPct } from "@/lib/stock";
import { StockClient, type StockTab } from "./StockClient";

const OWNER_TABS: StockTab[] = ["stock", "recipes", "receipt", "writeoff", "inventory", "history"];
const CASHIER_TABS: StockTab[] = ["stock", "receipt", "history"];

export default async function StockPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await requireSession();
  const isOwner = session.role === "OWNER";
  const allowed = isOwner ? OWNER_TABS : CASHIER_TABS;
  const raw = (await searchParams).tab as StockTab;
  const tab: StockTab = allowed.includes(raw) ? raw : "stock";

  const ingredients = await db.ingredient.findMany({ where: { active: true }, orderBy: { nameRu: "asc" } });
  const base = ingredients.map((i) => ({
    id: i.id,
    nameRu: i.nameRu,
    nameTg: i.nameTg,
    unit: i.unit,
    stock: i.stock,
    minStock: i.minStock,
    lastPrice: i.lastPrice,
  }));

  // данные только для открытой вкладки
  let extra: Record<string, unknown> = {};
  if (tab === "recipes") {
    const dishes = await db.dish.findMany({
      where: { active: true, category: { active: true } },
      orderBy: [{ category: { sort: "asc" } }, { sort: "asc" }],
      include: { category: true, recipe: { include: { ingredient: true } } },
    });
    extra = {
      dishes: dishes.map((d) => {
        const cost = dishCost(d.recipe);
        return {
          id: d.id,
          nameRu: d.nameRu,
          nameTg: d.nameTg,
          categoryRu: d.category.nameRu,
          categoryTg: d.category.nameTg,
          price: d.price,
          cost,
          margin: marginPct(d.price, cost),
          autoStopped: d.autoStopped,
          recipe: d.recipe.map((r) => ({ ingredientId: r.ingredientId, qty: r.qty })),
        };
      }),
    };
  }
  if (tab === "receipt") {
    const [suppliers, receipts] = await Promise.all([
      db.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.stockReceipt.findMany({
        orderBy: { id: "desc" },
        take: 15,
        include: { supplier: { select: { name: true } }, createdBy: { select: { name: true } }, _count: { select: { movements: true } } },
      }),
    ]);
    extra = {
      suppliers,
      receipts: receipts.map((r) => ({
        id: r.id,
        date: r.date.toISOString(),
        supplier: r.supplier?.name ?? null,
        total: r.total,
        items: r._count.movements,
        by: r.createdBy?.name ?? "",
      })),
    };
  }
  if (tab === "writeoff" || tab === "history") {
    const moves = await db.stockMovement.findMany({
      where: tab === "writeoff" ? { type: "WRITE_OFF" } : {},
      orderBy: { id: "desc" },
      take: tab === "writeoff" ? 20 : 150,
      include: {
        ingredient: { select: { nameRu: true, nameTg: true, unit: true } },
        order: { select: { number: true } },
        createdBy: { select: { name: true } },
      },
    });
    extra = {
      movements: moves.map((m) => ({
        id: m.id,
        at: m.createdAt.toISOString(),
        type: m.type,
        nameRu: m.ingredient.nameRu,
        nameTg: m.ingredient.nameTg,
        unit: m.ingredient.unit,
        qty: m.qty,
        value: Math.round(Math.abs(m.qty) * (m.price ?? 0)),
        reason: m.reason,
        orderNumber: m.order?.number ?? null,
        orderId: m.orderId,
        by: m.createdBy?.name ?? "",
      })),
    };
  }

  return <StockClient tab={tab} tabs={allowed} isOwner={isOwner} ingredients={base} {...extra} />;
}
