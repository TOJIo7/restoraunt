import "server-only";
import { db } from "./db";
import { applyBp } from "./money";
import { waiterSalesAmount } from "./payroll";
import { addDays, startOfDay, ymd } from "./period";

/**
 * Категории расходов, которые НЕ вычитаются в прибыли повторно:
 * закупки уже сидят в себестоимости проданных блюд, зарплата считается по начислению.
 */
export const EXPENSES_NOT_IN_PROFIT = ["PURCHASE", "SALARY"];

/** Ежемесячные расходы: в прибыли распределяются равномерно по дням своего месяца. */
export const MONTHLY_EXPENSES = ["RENT", "UTILITIES"];

/**
 * Доля ежемесячного расхода, приходящаяся на период: дни пересечения периода с месяцем расхода
 * (только прошедшие) / дней в месяце. Так аренда не «обваливает» прибыль в день оплаты.
 */
function monthlyShare(date: Date, from: Date, to: Date) {
  const mStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const mEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const end = new Date(Math.min(to.getTime(), mEnd.getTime(), addDays(startOfDay(new Date()), 1).getTime()));
  const start = new Date(Math.max(from.getTime(), mStart.getTime()));
  const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  return days / Math.round((mEnd.getTime() - mStart.getTime()) / 86_400_000);
}

/** Начисленная зарплата за период (оклад — пропорционально дням периода). */
async function salaryForRange(from: Date, to: Date) {
  const [employees, attendance, orders, adjustments] = await Promise.all([
    db.employee.findMany(),
    db.attendance.findMany({ where: { checkIn: { gte: from, lt: to } } }),
    db.order.findMany({ where: { status: "PAID", paidAt: { gte: from, lt: to }, waiterId: { not: null } }, select: { waiterId: true, subtotal: true, discountAmount: true } }),
    db.salaryAdjustment.findMany({ where: { date: { gte: from, lt: to }, type: { in: ["BONUS", "FINE"] } } }),
  ]);
  const end = new Date(Math.min(to.getTime(), addDays(startOfDay(new Date()), 1).getTime()));
  let total = 0;
  for (const e of employees) {
    if (e.payType === "MONTHLY" && e.salary && e.active) {
      // по каждому прошедшему дню периода — доля оклада этого месяца (будущие дни не начисляем)
      for (let d = startOfDay(from); d < end; d = addDays(d, 1)) {
        const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        total += e.salary / daysInMonth;
      }
    }
    const att = attendance.filter((a) => a.employeeId === e.id);
    if (e.payType === "PER_SHIFT") total += new Set(att.map((a) => a.checkIn.toDateString())).size * e.rate;
    if (e.payType === "HOURLY") total += att.reduce((s, a) => s + (a.checkOut ? (a.checkOut.getTime() - a.checkIn.getTime()) / 3_600_000 : 0), 0) * e.rate;
    if (e.salesPercentBp) total += applyBp(orders.filter((o) => o.waiterId === e.id).reduce((s, o) => s + waiterSalesAmount(o), 0), e.salesPercentBp);
  }
  for (const a of adjustments) total += a.type === "BONUS" ? a.amount : -a.amount;
  return Math.round(total);
}

export async function getReport(from: Date, to: Date) {
  const [orders, expenses, monthly, movements, cancelled] = await Promise.all([
    db.order.findMany({
      where: { status: "PAID", paidAt: { gte: from, lt: to } },
      include: {
        items: { where: { removed: false }, include: { dish: { select: { id: true, nameRu: true, nameTg: true, category: { select: { nameRu: true, nameTg: true } } } } } },
        payments: true,
      },
    }),
    db.expense.findMany({ where: { date: { gte: from, lt: to } }, orderBy: { date: "desc" } }),
    db.expense.findMany({
      where: { category: { in: MONTHLY_EXPENSES }, date: { gte: new Date(from.getFullYear(), from.getMonth(), 1), lt: new Date(to.getFullYear(), to.getMonth() + 1, 1) } },
    }),
    db.stockMovement.findMany({ where: { createdAt: { gte: from, lt: to } }, include: { ingredient: { select: { nameRu: true, nameTg: true, unit: true } } } }),
    db.order.count({ where: { status: "CANCELLED", cancelledAt: { gte: from, lt: to } } }),
  ]);

  // ---------- Сводка ----------
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const cost = orders.reduce((s, o) => s + o.costTotal, 0);
  const byMethod: Record<string, number> = { CASH: 0, CARD: 0, TRANSFER: 0, QR: 0 };
  const byType: Record<string, number> = { DINE_IN: 0, TAKEAWAY: 0, DELIVERY: 0 };
  for (const o of orders) {
    byType[o.type] = (byType[o.type] ?? 0) + o.total;
    for (const p of o.payments) byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount;
  }
  const prepaid = orders.reduce((s, o) => s + o.prepaymentApplied, 0);

  // по дням (или по часам, если период — один день)
  const oneDay = to.getTime() - from.getTime() <= 86_400_000;
  const series: { key: string; revenue: number; orders: number }[] = [];
  if (oneDay) {
    for (let h = 9; h <= 23; h++) series.push({ key: String(h).padStart(2, "0"), revenue: 0, orders: 0 });
    for (const o of orders) {
      const h = String(o.paidAt!.getHours()).padStart(2, "0");
      const s = series.find((x) => x.key === h);
      if (s) {
        s.revenue += o.total;
        s.orders += 1;
      }
    }
  } else {
    for (let d = startOfDay(from); d < to; d = addDays(d, 1)) series.push({ key: ymd(d), revenue: 0, orders: 0 });
    for (const o of orders) {
      const s = series.find((x) => x.key === ymd(o.paidAt!));
      if (s) {
        s.revenue += o.total;
        s.orders += 1;
      }
    }
  }

  // ---------- Блюда ----------
  const dishMap = new Map<number, { id: number; nameRu: string; nameTg: string; categoryRu: string; categoryTg: string; qty: number; revenue: number; cost: number }>();
  for (const o of orders)
    for (const i of o.items) {
      const cur = dishMap.get(i.dishId) ?? {
        id: i.dishId,
        nameRu: i.dish.nameRu,
        nameTg: i.dish.nameTg,
        categoryRu: i.dish.category.nameRu,
        categoryTg: i.dish.category.nameTg,
        qty: 0,
        revenue: 0,
        cost: 0,
      };
      cur.qty += i.qty;
      cur.revenue += i.qty * i.price;
      cur.cost += i.qty * i.costPrice;
      dishMap.set(i.dishId, cur);
    }
  const dishes = [...dishMap.values()].map((d) => ({ ...d, profit: d.revenue - d.cost, margin: d.revenue ? Math.round(((d.revenue - d.cost) / d.revenue) * 100) : 0 }));

  // ---------- Расходы ----------
  const expByCat: Record<string, number> = { RENT: 0, UTILITIES: 0, PURCHASE: 0, SALARY: 0, OTHER: 0 };
  for (const e of expenses) expByCat[e.category] = (expByCat[e.category] ?? 0) + e.amount;
  // в прибыль: разовые расходы периода + доля ежемесячных (аренда, коммунальные) по дням
  const oneOff = expenses.filter((e) => !EXPENSES_NOT_IN_PROFIT.includes(e.category) && !MONTHLY_EXPENSES.includes(e.category)).reduce((s, e) => s + e.amount, 0);
  const monthlyPart = Math.round(monthly.reduce((s, e) => s + e.amount * monthlyShare(e.date, from, to), 0));
  const expensesInProfit = oneOff + monthlyPart;

  // ---------- Прибыль ----------
  const salary = await salaryForRange(from, to);
  const grossProfit = revenue - cost;
  const profit = grossProfit - expensesInProfit - salary;

  // ---------- Склад ----------
  const sumMoves = (type: string) => movements.filter((m) => m.type === type).reduce((s, m) => s + Math.round(Math.abs(m.qty) * (m.price ?? 0)), 0);
  const lossMap = new Map<string, { nameRu: string; nameTg: string; unit: string; qty: number; value: number }>();
  for (const m of movements.filter((x) => x.type === "WRITE_OFF" || (x.type === "INVENTORY" && x.qty < 0 && x.reason !== "Начальный остаток"))) {
    const cur = lossMap.get(m.ingredient.nameRu) ?? { nameRu: m.ingredient.nameRu, nameTg: m.ingredient.nameTg, unit: m.ingredient.unit, qty: 0, value: 0 };
    cur.qty += Math.abs(m.qty);
    cur.value += Math.round(Math.abs(m.qty) * (m.price ?? 0));
    lossMap.set(m.ingredient.nameRu, cur);
  }
  const ingredients = await db.ingredient.findMany({ where: { active: true } });

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    oneDay,
    summary: { revenue, orders: orders.length, avg: orders.length ? Math.round(revenue / orders.length) : 0, cost, grossProfit, byMethod, byType, prepaid, cancelled },
    series,
    dishes,
    expenses: {
      byCat: expByCat,
      total: expenses.reduce((s, e) => s + e.amount, 0),
      list: expenses.map((e) => ({ id: e.id, category: e.category, amount: e.amount, date: e.date.toISOString(), comment: e.comment, fromCash: !!e.cashOperationId })),
    },
    profit: { revenue, cost, grossProfit, expenses: expensesInProfit, monthlyPart, salary, profit, purchases: expByCat.PURCHASE, salaryPaid: expByCat.SALARY },
    stock: {
      value: ingredients.reduce((s, i) => s + Math.max(i.stock, 0) * i.lastPrice, 0),
      low: ingredients.filter((i) => i.stock < i.minStock).length,
      receipts: sumMoves("RECEIPT"),
      sold: sumMoves("SALE"),
      writeOffs: sumMoves("WRITE_OFF"),
      inventory: movements.filter((m) => m.type === "INVENTORY" && m.reason !== "Начальный остаток").reduce((s, m) => s + Math.round(m.qty * (m.price ?? 0)), 0),
      losses: [...lossMap.values()].sort((a, b) => b.value - a.value).slice(0, 10),
    },
  };
}

export type Report = Awaited<ReturnType<typeof getReport>>;
