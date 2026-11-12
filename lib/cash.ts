import "server-only";
import { db } from "./db";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient | typeof db;

export async function getOpenShift(tx: Tx = db) {
  return tx.cashShift.findFirst({ where: { closedAt: null }, orderBy: { openedAt: "desc" } });
}

export type ShiftSummary = {
  ordersCount: number;
  revenue: number; // сумма оплаченных заказов
  byMethod: Record<string, number>;
  byType: Record<string, number>;
  cashSales: number;
  deposits: number;
  withdrawals: number;
  expenses: number;
  expectedCash: number;
};

/**
 * Сводка по кассовой смене.
 * Ожидаемые наличные = на начало + продажи наличными + внесения − изъятия − расходы из кассы.
 * Заказ, отменённый после оплаты, в продажи не входит (деньги вернули гостю).
 */
export async function getShiftSummary(shiftId: number, tx: Tx = db): Promise<ShiftSummary> {
  const shift = await tx.cashShift.findUniqueOrThrow({ where: { id: shiftId } });
  const [orders, ops] = await Promise.all([
    tx.order.findMany({ where: { cashShiftId: shiftId, status: "PAID" }, include: { payments: true } }),
    tx.cashOperation.findMany({ where: { cashShiftId: shiftId } }),
  ]);

  const byMethod: Record<string, number> = { CASH: 0, CARD: 0, TRANSFER: 0, QR: 0 };
  const byType: Record<string, number> = { DINE_IN: 0, TAKEAWAY: 0, DELIVERY: 0 };
  let revenue = 0;
  for (const o of orders) {
    revenue += o.total;
    byType[o.type] = (byType[o.type] ?? 0) + o.total;
    for (const p of o.payments) byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount;
  }
  const sum = (type: string) => ops.filter((x) => x.type === type).reduce((s, x) => s + x.amount, 0);
  const deposits = sum("DEPOSIT");
  const withdrawals = sum("WITHDRAWAL");
  const expenses = sum("EXPENSE");
  const cashSales = byMethod.CASH;

  return {
    ordersCount: orders.length,
    revenue,
    byMethod,
    byType,
    cashSales,
    deposits,
    withdrawals,
    expenses,
    expectedCash: shift.openingCash + cashSales + deposits - withdrawals - expenses,
  };
}
