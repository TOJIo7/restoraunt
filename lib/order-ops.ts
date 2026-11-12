import "server-only";
import type { Prisma } from "@prisma/client";
import { computeTotals } from "./orders";

type Tx = Prisma.TransactionClient;

/**
 * Пересчитать и сохранить суммы заказа после любого изменения.
 * Предоплату берём из брони (источник правды), а не из прошлого значения в заказе —
 * иначе пустой заказ «съел» бы предоплату до нуля.
 */
export async function recalc(tx: Tx, orderId: number) {
  const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, reservation: true, delivery: true } });
  const t = computeTotals({
    ...o,
    deliveryFee: o.delivery?.fee ?? o.deliveryFee,
    prepaymentApplied: o.reservation?.prepayment ?? 0,
  });
  return tx.order.update({
    where: { id: orderId },
    data: {
      subtotal: t.subtotal,
      discountAmount: t.discountAmount,
      serviceAmount: t.serviceAmount,
      deliveryFee: t.deliveryFee,
      total: t.total,
      prepaymentApplied: t.prepaymentApplied,
    },
  });
}

/** Создать заказ со следующим номером. Номера сквозные: 1001, 1002… */
export async function createOrderRecord(
  tx: Tx,
  data: { type: string; tableId: number | null; waiterId: number | null; guests: number | null; createdById: number },
) {
  const settings = await tx.setting.findUnique({ where: { id: 1 } });
  const last = await tx.order.aggregate({ _max: { number: true } });
  return tx.order.create({
    data: {
      ...data,
      number: (last._max.number ?? 1000) + 1,
      serviceChargeBp: data.type === "DINE_IN" ? (settings?.serviceChargeBp ?? 0) : 0,
    },
  });
}
