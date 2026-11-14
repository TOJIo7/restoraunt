"use server";

// Заявки с сайта: кассир звонит гостю и подтверждает (→ настоящий заказ / бронь) или отклоняет.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/session";
import { getOpenShift } from "@/lib/cash";
import { createOrderRecord, recalc } from "@/lib/order-ops";
import { int, optStr, reqStr, run, ValidationError } from "@/lib/validate";
import { deliveryFeeFor } from "@/lib/site";

const HOUR = 3_600_000;

function refresh() {
  revalidatePath("/requests");
  revalidatePath("/orders");
  revalidatePath("/reservations");
  revalidatePath("/hall");
}

async function openRequest(id: number) {
  const r = await db.siteRequest.findUnique({ where: { id: int(id, { min: 1 }) } });
  if (!r) throw new ValidationError("notFound");
  if (r.status !== "NEW") throw new ValidationError("requestHandled");
  return r;
}

/** Подтвердить заявку. Для брони можно сразу выбрать стол. Возвращает id заказа или брони. */
export async function acceptRequest(id: number, opts: { tableId?: number | null } = {}) {
  return run(async () => {
    const s = await requireSession();
    const r = await openRequest(id);

    if (r.kind === "ORDER") {
      if (!(await getOpenShift())) throw new ValidationError("noShift");
      const items = JSON.parse(r.items ?? "[]") as { dishId: number; qty: number }[];
      const order = await db.$transaction(async (tx) => {
        // кто-то мог успеть обработать заявку параллельно
        const claimed = await tx.siteRequest.updateMany({ where: { id: r.id, status: "NEW" }, data: { status: "ACCEPTED" } });
        if (claimed.count === 0) throw new ValidationError("requestHandled");
        const type = r.orderType === "DELIVERY" ? "DELIVERY" : "TAKEAWAY";
        const created = await createOrderRecord(tx, { type, tableId: null, waiterId: null, guests: null, createdById: s.uid });
        let subtotal = 0;
        for (const it of items) {
          const dish = await tx.dish.findFirst({ where: { id: it.dishId, active: true } });
          if (!dish) throw new ValidationError("notFound");
          if (dish.inStopList) throw new ValidationError("dishStopped");
          subtotal += dish.price * it.qty;
          await tx.orderItem.create({ data: { orderId: created.id, dishId: dish.id, qty: it.qty, price: dish.price } });
        }
        const pay = r.payMethod === "CARD" ? "картой" : "наличными";
        const note = [`С сайта, заявка №${r.id}. Оплата ${pay}`, r.comment].filter(Boolean).join(". ");
        await tx.order.update({ where: { id: created.id }, data: { comment: note.slice(0, 300) } });
        if (type === "DELIVERY") {
          await tx.delivery.create({
            data: {
              orderId: created.id,
              customerName: r.name,
              phone: r.phone,
              address: r.address ?? "",
              lat: r.lat,
              lng: r.lng,
              fee: deliveryFeeFor(subtotal),
            },
          });
        }
        await recalc(tx, created.id);
        await tx.siteRequest.update({ where: { id: r.id }, data: { orderId: created.id, handledById: s.uid, handledAt: new Date() } });
        return created;
      });
      await audit(s.uid, "SITE_REQUEST_ACCEPTED", "SiteRequest", r.id, { orderId: order.id, number: order.number });
      refresh();
      return { orderId: order.id, reservationId: null as number | null };
    }

    // бронь
    const tableId = opts.tableId ? int(opts.tableId, { min: 1 }) : null;
    const startsAt = r.startsAt!;
    const res = await db.$transaction(async (tx) => {
      const claimed = await tx.siteRequest.updateMany({ where: { id: r.id, status: "NEW" }, data: { status: "ACCEPTED" } });
      if (claimed.count === 0) throw new ValidationError("requestHandled");
      const near = await tx.reservation.findMany({
        where: { status: "BOOKED", startsAt: { gte: new Date(startsAt.getTime() - 3 * HOUR), lte: new Date(startsAt.getTime() + 3 * HOUR) } },
      });
      for (const x of near) {
        const close = Math.abs(x.startsAt.getTime() - startsAt.getTime()) <= 2 * HOUR;
        if (x.wholeHall) throw new ValidationError("hallReserved");
        if (tableId && close && x.tableId === tableId) throw new ValidationError("tableReserved");
      }
      if (tableId && !(await tx.diningTable.findFirst({ where: { id: tableId, active: true } }))) throw new ValidationError("notFound");
      const created = await tx.reservation.create({
        data: {
          startsAt,
          guests: r.guests ?? 1,
          tableId,
          name: r.name,
          phone: r.phone,
          comment: [`С сайта, заявка №${r.id}`, r.comment].filter(Boolean).join(". ").slice(0, 300),
        },
      });
      await tx.siteRequest.update({ where: { id: r.id }, data: { reservationId: created.id, handledById: s.uid, handledAt: new Date() } });
      return created;
    });
    await audit(s.uid, "SITE_REQUEST_ACCEPTED", "SiteRequest", r.id, { reservationId: res.id });
    refresh();
    return { orderId: null as number | null, reservationId: res.id };
  });
}

export async function rejectRequest(id: number, reason: string) {
  return run(async () => {
    const s = await requireSession();
    const r = await openRequest(id);
    const why = reqStr(reason, 200);
    const done = await db.siteRequest.updateMany({
      where: { id: r.id, status: "NEW" },
      data: { status: "REJECTED", rejectReason: optStr(why, 200), handledById: s.uid, handledAt: new Date() },
    });
    if (done.count === 0) throw new ValidationError("requestHandled");
    await audit(s.uid, "SITE_REQUEST_REJECTED", "SiteRequest", r.id, { reason: why });
    refresh();
  });
}
