import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getOpenShift } from "@/lib/cash";
import { getCouriers, getFreeTables, getWaiters } from "@/lib/order-view";
import { OrdersClient, type OrderCard } from "./OrdersClient";

const TABS = ["open", "delivery", "paid", "cancelled"] as const;
type Tab = (typeof TABS)[number];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireSession();
  const raw = (await searchParams).tab;
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : "open";

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  // активная доставка: не отменена и (ещё не доставлена или ещё не оплачена)
  const activeDelivery = {
    type: "DELIVERY",
    status: { not: "CANCELLED" },
    OR: [{ delivery: { status: { not: "DELIVERED" } } }, { status: { in: ["OPEN", "BILL"] } }],
  };
  const where =
    tab === "open"
      ? { status: { in: ["OPEN", "BILL"] } }
      : tab === "delivery"
        ? activeDelivery
      : tab === "paid"
        ? { status: "PAID", paidAt: { gte: startOfDay } }
        : { status: "CANCELLED", cancelledAt: { gte: startOfDay } };

  const [orders, waiters, couriers, freeTables, shift, counts] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: tab === "open" ? { openedAt: "asc" } : { id: "desc" },
      take: 100,
      include: {
        table: { select: { number: true } },
        waiter: { select: { name: true } },
        items: { where: { removed: false }, select: { qty: true } },
        delivery: { include: { courier: { select: { name: true } } } },
      },
    }),
    getWaiters(),
    getCouriers(),
    getFreeTables(),
    getOpenShift(),
    Promise.all([
      db.order.count({ where: { status: { in: ["OPEN", "BILL"] } } }),
      db.order.count({ where: activeDelivery }),
      db.order.count({ where: { status: "PAID", paidAt: { gte: startOfDay } } }),
      db.order.count({ where: { status: "CANCELLED", cancelledAt: { gte: startOfDay } } }),
    ]),
  ]);

  const cards: OrderCard[] = orders.map((o) => ({
    id: o.id,
    number: o.number,
    type: o.type,
    status: o.status,
    tableNumber: o.table?.number ?? null,
    waiterName: o.waiter?.name ?? null,
    items: o.items.reduce((s, i) => s + i.qty, 0),
    total: o.total,
    at: (o.paidAt ?? o.cancelledAt ?? o.openedAt).toISOString(),
    openedAt: o.openedAt.toISOString(),
    delivery: o.delivery ? { status: o.delivery.status, address: o.delivery.address, customer: o.delivery.customerName, courier: o.delivery.courier?.name ?? null } : null,
  }));

  return (
    <OrdersClient
      tab={tab}
      orders={cards}
      counts={{ open: counts[0], delivery: counts[1], paid: counts[2], cancelled: counts[3] }}
      waiters={waiters}
      couriers={couriers}
      freeTables={freeTables}
      hasShift={!!shift}
    />
  );
}
