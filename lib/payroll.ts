import "server-only";
import { db } from "./db";
import { applyBp } from "./money";
import { monthRange } from "./period";

/**
 * Продажи официанта для процента: сумма блюд после скидки (без обслуживания и доставки),
 * только оплаченные заказы. Обслуживание — доход ресторана, не продажа официанта.
 */
export function waiterSalesAmount(o: { subtotal: number; discountAmount: number }) {
  return o.subtotal - o.discountAmount;
}

export type PayrollRow = {
  employeeId: number;
  name: string;
  position: string;
  payType: string;
  salary: number;
  rate: number;
  salesPercentBp: number;
  shifts: number; // дней с отметкой прихода
  hours: number; // отработано часов (по закрытым отметкам)
  lateCount: number;
  lateMinutes: number;
  base: number; // оклад / смены × ставка / часы × ставка
  sales: number;
  salesBonus: number;
  bonuses: number;
  fines: number;
  advances: number;
  payouts: number;
  earned: number; // начислено: база + % + премии − штрафы
  due: number; // к выдаче: начислено − авансы − уже выплачено
};

/** Зарплата за месяц по всем активным сотрудникам (и уволенным, если у них были начисления). */
export async function computePayroll(month: string): Promise<PayrollRow[]> {
  const { from, to } = monthRange(month);
  const [employees, attendance, orders, adjustments] = await Promise.all([
    db.employee.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] }),
    db.attendance.findMany({ where: { checkIn: { gte: from, lt: to } } }),
    db.order.findMany({
      where: { status: "PAID", paidAt: { gte: from, lt: to }, waiterId: { not: null } },
      select: { waiterId: true, subtotal: true, discountAmount: true },
    }),
    db.salaryAdjustment.findMany({ where: { date: { gte: from, lt: to } } }),
  ]);

  const rows: PayrollRow[] = [];
  for (const e of employees) {
    const att = attendance.filter((a) => a.employeeId === e.id);
    const days = new Set(att.map((a) => a.checkIn.toDateString())).size;
    const hours = att.reduce((s, a) => s + (a.checkOut ? (a.checkOut.getTime() - a.checkIn.getTime()) / 3_600_000 : 0), 0);
    const late = att.filter((a) => a.lateMinutes > 0);
    const sales = orders.filter((o) => o.waiterId === e.id).reduce((s, o) => s + waiterSalesAmount(o), 0);
    const adj = adjustments.filter((a) => a.employeeId === e.id);
    const sum = (type: string) => adj.filter((a) => a.type === type).reduce((s, a) => s + a.amount, 0);

    const base = e.payType === "MONTHLY" ? e.salary : e.payType === "PER_SHIFT" ? days * e.rate : Math.round(hours * e.rate);
    const salesBonus = applyBp(sales, e.salesPercentBp);
    const bonuses = sum("BONUS");
    const fines = sum("FINE");
    const advances = sum("ADVANCE");
    const payouts = sum("PAYOUT");
    const earned = base + salesBonus + bonuses - fines;

    // уволенных без движения за месяц не показываем
    if (!e.active && !att.length && !adj.length && !sales) continue;
    rows.push({
      employeeId: e.id,
      name: e.name,
      position: e.position,
      payType: e.payType,
      salary: e.salary,
      rate: e.rate,
      salesPercentBp: e.salesPercentBp,
      shifts: days,
      hours: Math.round(hours * 10) / 10,
      lateCount: late.length,
      lateMinutes: late.reduce((s, a) => s + a.lateMinutes, 0),
      base,
      sales,
      salesBonus,
      bonuses,
      fines,
      advances,
      payouts,
      earned,
      due: earned - advances - payouts,
    });
  }
  return rows;
}

/** Продажи по официантам за период: сумма, количество заказов, средний чек. */
export async function waiterSales(from: Date, to: Date) {
  const orders = await db.order.findMany({
    where: { status: "PAID", paidAt: { gte: from, lt: to } },
    select: { waiterId: true, total: true, subtotal: true, discountAmount: true, waiter: { select: { name: true } } },
  });
  const map = new Map<string, { waiterId: number | null; name: string | null; orders: number; total: number; sales: number }>();
  for (const o of orders) {
    const key = String(o.waiterId ?? "none");
    const cur = map.get(key) ?? { waiterId: o.waiterId, name: o.waiter?.name ?? null, orders: 0, total: 0, sales: 0 };
    cur.orders += 1;
    cur.total += o.total;
    cur.sales += waiterSalesAmount(o);
    map.set(key, cur);
  }
  return [...map.values()].map((r) => ({ ...r, avg: r.orders ? Math.round(r.total / r.orders) : 0 })).sort((a, b) => b.total - a.total);
}
