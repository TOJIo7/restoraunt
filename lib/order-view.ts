import "server-only";
import { db } from "./db";

/** Всё, что нужно экрану заказа и чеку, в простом сериализуемом виде. */
export async function getOrderView(id: number) {
  const o = await db.order.findUnique({
    where: { id },
    include: {
      items: { include: { dish: { select: { nameRu: true, nameTg: true } } }, orderBy: { id: "asc" } },
      payments: { orderBy: { id: "asc" } },
      table: { select: { number: true } },
      waiter: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      delivery: { include: { courier: { select: { name: true } } } },
      reservation: { select: { id: true, name: true, prepayment: true, prepaymentMethod: true } },
    },
  });
  if (!o) return null;
  return {
    id: o.id,
    number: o.number,
    type: o.type,
    status: o.status,
    tableId: o.tableId,
    tableNumber: o.table?.number ?? null,
    waiterId: o.waiterId,
    waiterName: o.waiter?.name ?? null,
    guests: o.guests,
    comment: o.comment,
    discountType: o.discountType,
    discountValue: o.discountValue,
    discountReason: o.discountReason,
    serviceChargeBp: o.serviceChargeBp,
    deliveryFee: o.deliveryFee,
    prepaymentApplied: o.prepaymentApplied,
    total: o.total,
    openedAt: o.openedAt.toISOString(),
    paidAt: o.paidAt?.toISOString() ?? null,
    cancelReason: o.cancelReason,
    cashierName: o.createdBy?.name ?? null,
    items: o.items.map((i) => ({
      id: i.id,
      dishId: i.dishId,
      nameRu: i.dish.nameRu,
      nameTg: i.dish.nameTg,
      qty: i.qty,
      price: i.price,
      comment: i.comment,
      removed: i.removed,
      removedReason: i.removedReason,
      createdAt: i.createdAt.toISOString(),
    })),
    payments: o.payments.map((p) => ({ id: p.id, method: p.method, amount: p.amount, received: p.received, provider: p.provider })),
    delivery: o.delivery
      ? {
          customerName: o.delivery.customerName,
          phone: o.delivery.phone,
          address: o.delivery.address,
          fee: o.delivery.fee,
          courierId: o.delivery.courierId,
          courierName: o.delivery.courier?.name ?? null,
          status: o.delivery.status,
        }
      : null,
    reservation: o.reservation,
  };
}
export type OrderView = NonNullable<Awaited<ReturnType<typeof getOrderView>>>;

/** Меню для выбора блюд: активные категории и блюда. */
export async function getPickerMenu() {
  const cats = await db.category.findMany({
    where: { active: true },
    orderBy: [{ sort: "asc" }, { id: "asc" }],
    include: {
      dishes: {
        where: { active: true },
        orderBy: [{ sort: "asc" }, { id: "asc" }],
        select: { id: true, nameRu: true, nameTg: true, price: true, inStopList: true, photo: true },
      },
    },
  });
  return cats.map((c) => ({ id: c.id, nameRu: c.nameRu, nameTg: c.nameTg, dishes: c.dishes }));
}
export type PickerMenu = Awaited<ReturnType<typeof getPickerMenu>>;

export async function getWaiters() {
  return db.employee.findMany({ where: { active: true, position: "WAITER" }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

export async function getCouriers() {
  return db.employee.findMany({ where: { active: true, position: "COURIER" }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}

export async function getSettings() {
  const s = await db.setting.findUnique({ where: { id: 1 } });
  return { restaurantName: s?.restaurantName ?? "", soundEnabled: s?.soundEnabled ?? true, serviceChargeBp: s?.serviceChargeBp ?? 0 };
}

/** Свободные столы (для открытия и переноса заказа). */
export async function getFreeTables() {
  const tables = await db.diningTable.findMany({
    where: { active: true, orders: { none: { status: { in: ["OPEN", "BILL"] } } } },
    orderBy: { number: "asc" },
    select: { id: true, number: true, seats: true },
  });
  return tables;
}
