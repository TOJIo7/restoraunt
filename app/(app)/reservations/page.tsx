import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getOpenShift } from "@/lib/cash";
import { getFreeTables } from "@/lib/order-view";
import { ReservationsClient, type ReservationRow } from "./ReservationsClient";

/** YYYY-MM-DD по местному времени */
function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireSession();
  const raw = (await searchParams).date;
  const today = localDate(new Date());
  const date = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && !isNaN(new Date(`${raw}T00:00:00`).getTime()) ? raw : today;
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  // неделя от выбранного дня — для полоски с количеством броней
  const weekEnd = new Date(dayStart.getTime() + 7 * 86_400_000);

  const [list, week, tables, freeTables, shift] = await Promise.all([
    db.reservation.findMany({
      where: { startsAt: { gte: dayStart, lt: dayEnd } },
      orderBy: { startsAt: "asc" },
      include: { table: { select: { number: true } } },
    }),
    db.reservation.findMany({ where: { status: "BOOKED", startsAt: { gte: dayStart, lt: weekEnd } }, select: { startsAt: true } }),
    db.diningTable.findMany({ where: { active: true }, orderBy: { number: "asc" }, select: { id: true, number: true, seats: true } }),
    getFreeTables(),
    getOpenShift(),
  ]);

  const counts: Record<string, number> = {};
  for (const r of week) counts[localDate(r.startsAt)] = (counts[localDate(r.startsAt)] ?? 0) + 1;

  const rows: ReservationRow[] = list.map((r) => ({
    id: r.id,
    startsAt: r.startsAt.toISOString(),
    date: localDate(r.startsAt),
    time: `${String(r.startsAt.getHours()).padStart(2, "0")}:${String(r.startsAt.getMinutes()).padStart(2, "0")}`,
    guests: r.guests,
    tableId: r.tableId,
    tableNumber: r.table?.number ?? null,
    wholeHall: r.wholeHall,
    name: r.name,
    phone: r.phone,
    prepayment: r.prepayment,
    prepaymentMethod: r.prepaymentMethod,
    status: r.status,
    comment: r.comment,
    orderId: r.orderId,
  }));

  return <ReservationsClient date={date} today={today} rows={rows} weekCounts={counts} tables={tables} freeTables={freeTables} hasShift={!!shift} />;
}
