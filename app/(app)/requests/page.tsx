import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getOpenShift } from "@/lib/cash";
import { RequestsClient, type RequestRow } from "./RequestsClient";

const TABS = ["NEW", "ACCEPTED", "REJECTED"] as const;
type RequestTab = (typeof TABS)[number];

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireSession();
  const raw = (await searchParams).tab;
  const tab: RequestTab = TABS.includes(raw as RequestTab) ? (raw as RequestTab) : "NEW";

  const [rows, counts, tables, shift] = await Promise.all([
    db.siteRequest.findMany({ where: { status: tab }, orderBy: { createdAt: tab === "NEW" ? "asc" : "desc" }, take: 100 }),
    db.siteRequest.groupBy({ by: ["status"], _count: true }),
    db.diningTable.findMany({ where: { active: true }, orderBy: { number: "asc" }, select: { id: true, number: true, seats: true } }),
    getOpenShift(),
  ]);

  // названия блюд для заказов
  const ids = new Set<number>();
  const parsed = rows.map((r) => {
    const items = r.items ? (JSON.parse(r.items) as { dishId: number; qty: number }[]) : [];
    items.forEach((i) => ids.add(i.dishId));
    return { r, items };
  });
  const dishes = await db.dish.findMany({ where: { id: { in: [...ids] } }, select: { id: true, nameRu: true, nameTg: true, price: true } });
  const byId = new Map(dishes.map((d) => [d.id, d]));

  const list: RequestRow[] = parsed.map(({ r, items }) => ({
    id: r.id,
    kind: r.kind as "ORDER" | "BOOKING",
    status: r.status,
    name: r.name,
    phone: r.phone,
    comment: r.comment,
    orderType: r.orderType,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    payMethod: r.payMethod,
    total: r.total,
    startsAt: r.startsAt?.toISOString() ?? null,
    guests: r.guests,
    orderId: r.orderId,
    reservationId: r.reservationId,
    rejectReason: r.rejectReason,
    createdAt: r.createdAt.toISOString(),
    items: items.map((i) => {
      const d = byId.get(i.dishId);
      return { dishId: i.dishId, qty: i.qty, nameRu: d?.nameRu ?? "?", nameTg: d?.nameTg ?? "?", price: d?.price ?? 0 };
    }),
  }));

  return (
    <RequestsClient
      tab={tab}
      rows={list}
      counts={Object.fromEntries(counts.map((c) => [c.status, c._count]))}
      tables={tables}
      hasShift={!!shift}
    />
  );
}
