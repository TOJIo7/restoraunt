"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/session";
import { EXPENSE_CATEGORIES } from "@/lib/orders";
import { int, money, oneOf, optStr, run, ValidationError } from "@/lib/validate";

/** Расход не из кассы (аренда переводом, коммунальные и т.п.). Расходы из кассы вносятся в «Кассе». */
export async function addExpense(input: { category: string; amount: string; date: string; comment?: string }) {
  return run(async () => {
    const s = await requireSession(["OWNER"]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new ValidationError("badDate");
    const date = new Date(`${input.date}T12:00:00`);
    if (isNaN(date.getTime()) || date.getTime() > Date.now() + 86_400_000) throw new ValidationError("badDate");
    const data = { category: oneOf(input.category, EXPENSE_CATEGORIES), amount: money(input.amount, { min: 1 }), date, comment: optStr(input.comment, 200), createdById: s.uid };
    const e = await db.expense.create({ data });
    await audit(s.uid, "EXPENSE_ADDED", "Expense", e.id, { ...data, date: input.date });
    revalidatePath("/reports");
  });
}

/** Удалить ошибочный расход. Расход из кассы так не удалить — он часть кассовой смены. */
export async function deleteExpense(id: number) {
  return run(async () => {
    const s = await requireSession(["OWNER"]);
    const e = await db.expense.findUnique({ where: { id: int(id, { min: 1 }) } });
    if (!e) throw new ValidationError("notFound");
    if (e.cashOperationId) throw new ValidationError("expenseFromCash");
    await db.expense.delete({ where: { id: e.id } });
    await audit(s.uid, "EXPENSE_DELETED", "Expense", e.id, { category: e.category, amount: e.amount });
    revalidatePath("/reports");
  });
}
