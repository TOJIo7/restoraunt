"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/session";
import { getOpenShift, getShiftSummary } from "@/lib/cash";
import { EXPENSE_CATEGORIES } from "@/lib/orders";
import { int, oneOf, optStr, run, ValidationError } from "@/lib/validate";

function refresh() {
  revalidatePath("/cash");
  revalidatePath("/hall");
  revalidatePath("/orders");
}

export async function openShift(openingCash: number) {
  return run(async () => {
    const s = await requireSession();
    const amount = int(openingCash, { min: 0 });
    const shift = await db.$transaction(async (tx) => {
      if (await getOpenShift(tx)) throw new ValidationError("shiftAlreadyOpen");
      return tx.cashShift.create({ data: { openedById: s.uid, openingCash: amount } });
    });
    await audit(s.uid, "SHIFT_OPENED", "CashShift", shift.id, { openingCash: amount });
    refresh();
  });
}

/** Движение денег в кассе: расход (покупка, оплата услуги), внесение или изъятие. */
export async function addCashOperation(input: { type: string; amount: number; category?: string | null; comment?: string | null }) {
  return run(async () => {
    const s = await requireSession();
    const type = oneOf(input.type, ["EXPENSE", "DEPOSIT", "WITHDRAWAL"] as const);
    const amount = int(input.amount, { min: 1 });
    const category = type === "EXPENSE" ? oneOf(input.category, EXPENSE_CATEGORIES) : null;
    const comment = optStr(input.comment, 200);

    const op = await db.$transaction(async (tx) => {
      const shift = await getOpenShift(tx);
      if (!shift) throw new ValidationError("noShift");
      if (type !== "DEPOSIT") {
        // нельзя выдать из кассы больше, чем там есть
        const sum = await getShiftSummary(shift.id, tx);
        if (amount > sum.expectedCash) throw new ValidationError("notEnoughCash");
      }
      const created = await tx.cashOperation.create({ data: { cashShiftId: shift.id, type, amount, category, comment, createdById: s.uid } });
      // расход из кассы сразу попадает в расходы ресторана (для отчёта о прибыли)
      if (type === "EXPENSE") {
        await tx.expense.create({ data: { category: category!, amount, comment, cashOperationId: created.id, createdById: s.uid } });
      }
      return created;
    });
    await audit(s.uid, `CASH_${type}`, "CashOperation", op.id, { amount, category, comment });
    refresh();
  });
}

/** Закрыть смену: сравнить ожидаемые наличные с фактом. */
export async function closeShift(actualCash: number, comment?: string) {
  return run(async () => {
    const s = await requireSession();
    const actual = int(actualCash, { min: 0 });
    const shift = await db.$transaction(async (tx) => {
      const open = await getOpenShift(tx);
      if (!open) throw new ValidationError("noShift");
      const sum = await getShiftSummary(open.id, tx);
      return tx.cashShift.update({
        where: { id: open.id },
        data: {
          closedAt: new Date(),
          closedById: s.uid,
          expectedCash: sum.expectedCash,
          actualCash: actual,
          difference: actual - sum.expectedCash,
          comment: optStr(comment, 300),
        },
      });
    });
    await audit(s.uid, "SHIFT_CLOSED", "CashShift", shift.id, {
      expected: shift.expectedCash,
      actual,
      difference: shift.difference,
    });
    refresh();
    return { id: shift.id, expected: shift.expectedCash!, actual, difference: shift.difference! };
  });
}
