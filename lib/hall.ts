import "server-only";
import { db } from "./db";
import type { TableStatus } from "./constants";

/** За сколько до начала брони стол показывается как «бронь». */
const RESERVE_WINDOW_MS = 2 * 60 * 60 * 1000;

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
  reservation: { name: string; at: string; guests: number } | null;
};

/** Статус стола считается из заказов и броней — отдельно не хранится, поэтому не «застревает». */
export async function getHall(): Promise<HallTable[]> {
  const now = new Date();
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
        reservations: {
          where: {
            status: "BOOKED",
            startsAt: { gte: new Date(now.getTime() - RESERVE_WINDOW_MS), lte: new Date(now.getTime() + RESERVE_WINDOW_MS) },
          },
          orderBy: { startsAt: "asc" },
          take: 1,
        },
      },
    }),
    // бронь «весь зал» на ближайшие часы
    db.reservation.findFirst({
      where: {
        status: "BOOKED",
        wholeHall: true,
        startsAt: { gte: new Date(now.getTime() - RESERVE_WINDOW_MS), lte: new Date(now.getTime() + RESERVE_WINDOW_MS) },
      },
    }),
  ]);

  return tables.map((t) => {
    const order = t.orders[0];
    const res = t.reservations[0] ?? wholeHall;
    let status: TableStatus = "FREE";
    if (order) status = order.status === "BILL" ? "BILL" : "BUSY";
    else if (res) status = "RESERVED";
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
      reservation: !order && res ? { name: res.name, at: res.startsAt.toISOString(), guests: res.guests } : null,
    };
  });
}
