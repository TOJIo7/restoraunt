import "server-only";
import { db } from "./db";
import type { TableStatus } from "./constants";

/** За сколько до начала брони стол становится «бронь» (до этого за ним можно обслуживать гостей). */
const RESERVE_BEFORE_MS = 1 * 60 * 60 * 1000;
/** Сколько после начала брони стол ещё держим за опаздывающими гостями. */
const RESERVE_AFTER_MS = 2 * 60 * 60 * 1000;

type HallRes = { id: number; name: string; at: string; guests: number; wholeHall: boolean; prepayment: number };

export type HallTable = {
  id: number;
  number: number;
  seats: number;
  x: number;
  y: number;
  shape: string;
  status: TableStatus;
  /** с какого момента стол занят (ISO) — для «занят 25 мин» */
  since: string | null;
  orderId: number | null;
  orderTotal: number | null;
  /** бронь, которая вот-вот начнётся или уже идёт — стол держим */
  reservation: HallRes | null;
  /** бронь позже сегодня — стол пока можно занимать, но видно «бронь в 20:00» */
  upcoming: HallRes | null;
};

const toRes = (r: { id: number; name: string; startsAt: Date; guests: number; wholeHall: boolean; prepayment: number }): HallRes => ({
  id: r.id,
  name: r.name,
  at: r.startsAt.toISOString(),
  guests: r.guests,
  wholeHall: r.wholeHall,
  prepayment: r.prepayment,
});

/** Статус стола считается из заказов и броней — отдельно не хранится, поэтому не «застревает». */
export async function getHall(): Promise<HallTable[]> {
  const now = new Date();
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);
  const until = new Date(Math.max(dayEnd.getTime(), now.getTime() + RESERVE_BEFORE_MS));
  const range = { gte: new Date(now.getTime() - RESERVE_AFTER_MS), lte: until };

  const [tables, wholeHall] = await Promise.all([
    db.diningTable.findMany({
      where: { active: true },
      orderBy: { number: "asc" },
      include: {
        orders: {
          where: { status: { in: ["OPEN", "BILL"] } },
          orderBy: { openedAt: "asc" },
          take: 1,
          select: { id: true, status: true, openedAt: true, total: true },
        },
        reservations: { where: { status: "BOOKED", startsAt: range }, orderBy: { startsAt: "asc" }, take: 1 },
      },
    }),
    // бронь «весь зал» на сегодня
    db.reservation.findFirst({ where: { status: "BOOKED", wholeHall: true, startsAt: range }, orderBy: { startsAt: "asc" } }),
  ]);

  const soon = now.getTime() + RESERVE_BEFORE_MS;

  return tables.map((t) => {
    const order = t.orders[0];
    const own = t.reservations[0];
    // ближайшая из двух: бронь этого стола или банкет на весь зал
    const next = own && wholeHall ? (own.startsAt <= wholeHall.startsAt ? own : wholeHall) : (own ?? wholeHall);
    const holding = next && next.startsAt.getTime() <= soon ? next : null;
    const later = next && !holding ? next : null;

    let status: TableStatus = "FREE";
    if (order) status = order.status === "BILL" ? "BILL" : "BUSY";
    else if (holding) status = "RESERVED";
    return {
      id: t.id,
      number: t.number,
      seats: t.seats,
      x: t.x,
      y: t.y,
      shape: t.shape,
      status,
      since: order ? order.openedAt.toISOString() : null,
      orderId: order?.id ?? null,
      orderTotal: order?.total ?? null,
      reservation: !order && holding ? toRes(holding) : null,
      // занятому столу тоже показываем: гостей надо рассчитать до прихода брони
      upcoming: later ? toRes(later) : order && holding ? toRes(holding) : null,
    };
  });
}
