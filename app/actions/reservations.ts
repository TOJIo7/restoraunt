"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/session";
import { getOpenShift, getShiftSummary } from "@/lib/cash";
import { createOrderRecord, recalc } from "@/lib/order-ops";
import { PAYMENT_METHODS } from "@/lib/constants";
import { int, money, oneOf, optStr, phone, reqStr, run, ValidationError } from "@/lib/validate";

type Tx = Prisma.TransactionClient;
const HOUR = 3_600_000;

function refresh() {
  revalidatePath("/reservations");
  revalidatePath("/hall");
  revalidatePath("/cash");
}

export type ReservationInput = {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  guests: number;
  tableId?: number | null;
  wholeHall?: boolean;
  name: string;
  phone: string;
  comment?: string | null;
};

function parseInput(input: ReservationInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.time)) throw new ValidationError("badDate");
  // время — местное время кассового компьютера
  const startsAt = new Date(`${input.date}T${input.time}:00`);
  if (isNaN(startsAt.getTime())) throw new ValidationError("badDate");
  const wholeHall = !!input.wholeHall;
  return {
    startsAt,
    guests: int(input.guests, { min: 1, max: 500 }),
    wholeHall,
    tableId: !wholeHall && input.tableId ? int(input.tableId, { min: 1 }) : null,
    name: reqStr(input.name, 80),
    phone: phone(input.phone),
    comment: optStr(input.comment, 300),
  };
}

/** Пересечения: стол занят бронью ±2 часа; «весь зал» конфликтует с любой бронью ±3 часа. */
async function assertNoConflict(tx: Tx, r: { startsAt: Date; tableId: number | null; wholeHall: boolean }, exceptId?: number) {
  const window = (r.wholeHall ? 3 : 2) * HOUR;
  const near = await tx.reservation.findMany({
    where: {
      status: "BOOKED",
      id: exceptId ? { not: exceptId } : undefined,
      startsAt: { gte: new Date(r.startsAt.getTime() - window), lte: new Date(r.startsAt.getTime() + window) },
    },
  });
  for (const x of near) {
    if (r.wholeHall || x.wholeHall) throw new ValidationError("hallReserved");
    if (r.tableId && x.tableId === r.tableId) throw new ValidationError("tableReserved");
  }
}

export async function createReservation(input: ReservationInput & { prepayment?: string; prepaymentMethod?: string }) {
  return run(async () => {
    const s = await requireSession();
    const data = parseInput(input);
    if (data.startsAt.getTime() < Date.now() - HOUR) throw new ValidationError("reservationPast");
    const prepayment = input.prepayment ? money(input.prepayment) : 0;
    const method = prepayment ? oneOf(input.prepaymentMethod, PAYMENT_METHODS) : null;

    const r = await db.$transaction(async (tx) => {
      if (data.tableId && !(await tx.diningTable.findFirst({ where: { id: data.tableId, active: true } }))) throw new ValidationError("notFound");
      await assertNoConflict(tx, data);
      const created = await tx.reservation.create({ data: { ...data, prepayment, prepaymentMethod: method } });
      if (prepayment) {
        // предоплата — деньги в кассе этой смены (наличные учитываются в ожидаемой сумме)
        const shift = await getOpenShift(tx);
        if (!shift) throw new ValidationError("noShift");
        await tx.cashOperation.create({
          data: { cashShiftId: shift.id, type: "PREPAYMENT", amount: prepayment, category: method, comment: `Бронь №${created.id} · ${data.name}`, createdById: s.uid },
        });
      }
      return created;
    });
    await audit(s.uid, "RESERVATION_CREATED", "Reservation", r.id, { ...data, prepayment, method });
    refresh();
    return { id: r.id };
  });
}

/** Изменить бронь (время, стол, гостей, контакты). Предоплату здесь не меняем — это деньги. */
export async function updateReservation(id: number, input: ReservationInput) {
  return run(async () => {
    const s = await requireSession();
    const data = parseInput(input);
    await db.$transaction(async (tx) => {
      const r = await tx.reservation.findUnique({ where: { id: int(id, { min: 1 }) } });
      if (!r) throw new ValidationError("notFound");
      if (r.status !== "BOOKED") throw new ValidationError("reservationClosed");
      await assertNoConflict(tx, data, r.id);
      await tx.reservation.update({ where: { id: r.id }, data });
    });
    await audit(s.uid, "RESERVATION_UPDATED", "Reservation", id, data);
    refresh();
  });
}

/** Отменить бронь. Предоплату можно вернуть гостю — это расход из кассы. */
export async function cancelReservation(id: number, refund: boolean) {
  return run(async () => {
    const s = await requireSession();
    const r = await db.$transaction(async (tx) => {
      const r = await tx.reservation.findUnique({ where: { id: int(id, { min: 1 }) } });
      if (!r) throw new ValidationError("notFound");
      if (r.status !== "BOOKED") throw new ValidationError("reservationClosed");
      if (refund && r.prepayment > 0) {
        const shift = await getOpenShift(tx);
        if (!shift) throw new ValidationError("noShift");
        if (r.prepaymentMethod === "CASH" && r.prepayment > (await getShiftSummary(shift.id, tx)).expectedCash) throw new ValidationError("notEnoughCash");
        await tx.cashOperation.create({
          data: { cashShiftId: shift.id, type: "PREPAYMENT_REFUND", amount: r.prepayment, category: r.prepaymentMethod, comment: `Возврат брони №${r.id}`, createdById: s.uid },
        });
      }
      return tx.reservation.update({ where: { id: r.id }, data: { status: "CANCELLED" } });
    });
    await audit(s.uid, "RESERVATION_CANCELLED", "Reservation", id, { refund: refund && r.prepayment > 0, prepayment: r.prepayment });
    refresh();
  });
}

/** Гости не пришли. Предоплата остаётся у ресторана. */
export async function markNoShow(id: number) {
  return run(async () => {
    const s = await requireSession();
    const r = await db.reservation.findUnique({ where: { id: int(id, { min: 1 }) } });
    if (!r) throw new ValidationError("notFound");
    if (r.status !== "BOOKED") throw new ValidationError("reservationClosed");
    await db.reservation.update({ where: { id: r.id }, data: { status: "NO_SHOW" } });
    await audit(s.uid, "RESERVATION_NO_SHOW", "Reservation", id, { prepayment: r.prepayment });
    refresh();
  });
}

/**
 * Гости пришли: бронь превращается в заказ. Предоплата сразу вычитается из суммы к оплате.
 * Для брони «весь зал» или без стола нужно выбрать стол (обычно банкетный).
 */
export async function seatReservation(id: number, tableId?: number | null) {
  return run(async () => {
    const s = await requireSession();
    const order = await db.$transaction(async (tx) => {
      if (!(await getOpenShift(tx))) throw new ValidationError("noShift");
      const r = await tx.reservation.findUnique({ where: { id: int(id, { min: 1 }) } });
      if (!r) throw new ValidationError("notFound");
      if (r.status !== "BOOKED") throw new ValidationError("reservationClosed");
      const table = r.tableId ?? (tableId ? int(tableId, { min: 1 }) : null);
      if (!table) throw new ValidationError("chooseTable");
      const busy = await tx.order.count({ where: { tableId: table, status: { in: ["OPEN", "BILL"] } } });
      if (busy) throw new ValidationError("tableBusy");
      const o = await createOrderRecord(tx, { type: "DINE_IN", tableId: table, waiterId: null, guests: r.guests, createdById: s.uid });
      await tx.reservation.update({ where: { id: r.id }, data: { status: "SEATED", orderId: o.id, tableId: r.wholeHall ? r.tableId : table } });
      await recalc(tx, o.id);
      return o;
    });
    await audit(s.uid, "RESERVATION_SEATED", "Reservation", id, { orderId: order.id, number: order.number });
    refresh();
    revalidatePath("/orders");
    return { orderId: order.id };
  });
}
