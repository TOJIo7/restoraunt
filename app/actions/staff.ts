"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/session";
import { getOpenShift, getShiftSummary } from "@/lib/cash";
import { PAY_TYPES, POSITIONS } from "@/lib/constants";
import { addDays, startOfDay, startOfWeek } from "@/lib/period";
import { int, money, oneOf, optStr, phone, reqStr, run, ValidationError } from "@/lib/validate";

function refresh() {
  revalidatePath("/staff");
}

// ---------- Сотрудники (владелец) ----------

export async function saveEmployee(input: {
  id?: number;
  name: string;
  position: string;
  phone?: string;
  payType: string;
  salary: string;
  rate: string;
  salesPercent: string;
}) {
  return run(async () => {
    const s = await requireSession(["OWNER"]);
    const pct = String(input.salesPercent || "0").replace(",", ".");
    if (!/^\d{1,2}(\.\d{1,2})?$/.test(pct)) throw new ValidationError("badPercent");
    const data = {
      name: reqStr(input.name, 80),
      position: oneOf(input.position, POSITIONS),
      phone: input.phone?.trim() ? phone(input.phone) : null,
      payType: oneOf(input.payType, PAY_TYPES),
      salary: input.salary ? money(input.salary) : 0,
      rate: input.rate ? money(input.rate) : 0,
      salesPercentBp: Math.round(parseFloat(pct) * 100),
    };
    if (data.salesPercentBp > 3000) throw new ValidationError("badPercent");
    if (input.id) {
      const before = await db.employee.findUnique({ where: { id: int(input.id, { min: 1 }) } });
      if (!before) throw new ValidationError("notFound");
      await db.employee.update({ where: { id: before.id }, data });
      await audit(s.uid, "EMPLOYEE_UPDATED", "Employee", before.id, {
        ...data,
        ...(before.salary !== data.salary || before.rate !== data.rate ? { salaryFrom: before.salary, rateFrom: before.rate } : {}),
      });
    } else {
      const e = await db.employee.create({ data });
      await audit(s.uid, "EMPLOYEE_CREATED", "Employee", e.id, data);
    }
    refresh();
  });
}

/** Уволить: сотрудник исчезает из списков, но остаётся в истории заказов и зарплат. */
export async function archiveEmployee(id: number) {
  return run(async () => {
    const s = await requireSession(["OWNER"]);
    const e = await db.employee.findUnique({ where: { id: int(id, { min: 1 }) }, include: { user: true } });
    if (!e) throw new ValidationError("notFound");
    if (e.user?.active) throw new ValidationError("employeeHasLogin");
    await db.employee.update({ where: { id: e.id }, data: { active: false } });
    await db.shift.deleteMany({ where: { employeeId: e.id, startsAt: { gte: new Date() } } });
    await audit(s.uid, "EMPLOYEE_ARCHIVED", "Employee", e.id, { name: e.name });
    refresh();
  });
}

// ---------- График (владелец) ----------

function at(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new ValidationError("badDate");
  const d = new Date(`${date}T${time}:00`);
  if (isNaN(d.getTime())) throw new ValidationError("badDate");
  return d;
}

/** Смена на день: одна на сотрудника в день (повторное сохранение заменяет). Конец раньше начала — смена до утра. */
export async function saveShift(input: { employeeId: number; date: string; start: string; end: string }) {
  return run(async () => {
    const s = await requireSession(["OWNER"]);
    const employeeId = int(input.employeeId, { min: 1 });
    const startsAt = at(input.date, input.start);
    let endsAt = at(input.date, input.end);
    if (endsAt <= startsAt) endsAt = addDays(endsAt, 1);
    const dayStart = startOfDay(startsAt);
    await db.$transaction([
      db.shift.deleteMany({ where: { employeeId, startsAt: { gte: dayStart, lt: addDays(dayStart, 1) } } }),
      db.shift.create({ data: { employeeId, startsAt, endsAt } }),
    ]);
    await audit(s.uid, "SHIFT_SCHEDULED", "Employee", employeeId, { startsAt, endsAt });
    refresh();
  });
}

export async function deleteShift(employeeId: number, date: string) {
  return run(async () => {
    const s = await requireSession(["OWNER"]);
    const dayStart = at(date, "00:00");
    await db.shift.deleteMany({ where: { employeeId: int(employeeId, { min: 1 }), startsAt: { gte: dayStart, lt: addDays(dayStart, 1) } } });
    await audit(s.uid, "SHIFT_REMOVED", "Employee", employeeId, { date });
    refresh();
  });
}

/** Скопировать график прошлой недели на неделю, которая начинается с weekStart (пустые дни не трогаем). */
export async function copyPreviousWeek(weekStart: string) {
  return run(async () => {
    const s = await requireSession(["OWNER"]);
    const start = startOfWeek(at(weekStart, "12:00"));
    const prev = await db.shift.findMany({ where: { startsAt: { gte: addDays(start, -7), lt: start }, employee: { active: true } } });
    const existing = await db.shift.findMany({ where: { startsAt: { gte: start, lt: addDays(start, 7) } } });
    const taken = new Set(existing.map((x) => `${x.employeeId}:${startOfDay(x.startsAt).getTime()}`));
    const data = prev
      .map((x) => ({ employeeId: x.employeeId, startsAt: addDays(x.startsAt, 7), endsAt: addDays(x.endsAt, 7) }))
      .filter((x) => !taken.has(`${x.employeeId}:${startOfDay(x.startsAt).getTime()}`));
    if (data.length) await db.shift.createMany({ data });
    await audit(s.uid, "SCHEDULE_COPIED", "Shift", null, { weekStart, count: data.length });
    refresh();
    return { count: data.length };
  });
}

// ---------- Приход и уход (кассир и владелец) ----------

/** Отметить приход. Опоздание считается от начала смены по графику (если смена на сегодня есть). */
export async function checkIn(employeeId: number) {
  return run(async () => {
    const s = await requireSession();
    const id = int(employeeId, { min: 1 });
    const now = new Date();
    const result = await db.$transaction(async (tx) => {
      const e = await tx.employee.findFirst({ where: { id, active: true } });
      if (!e) throw new ValidationError("notFound");
      if (await tx.attendance.findFirst({ where: { employeeId: id, checkOut: null } })) throw new ValidationError("alreadyCheckedIn");
      const shift = await tx.shift.findFirst({
        where: { employeeId: id, startsAt: { gte: startOfDay(now), lt: addDays(startOfDay(now), 1) } },
        orderBy: { startsAt: "asc" },
      });
      const lateMinutes = shift ? Math.max(0, Math.floor((now.getTime() - shift.startsAt.getTime()) / 60000)) : 0;
      return tx.attendance.create({ data: { employeeId: id, checkIn: now, lateMinutes } });
    });
    await audit(s.uid, "CHECK_IN", "Employee", id, { lateMinutes: result.lateMinutes });
    refresh();
    return { lateMinutes: result.lateMinutes };
  });
}

export async function checkOut(employeeId: number) {
  return run(async () => {
    const s = await requireSession();
    const id = int(employeeId, { min: 1 });
    const open = await db.attendance.findFirst({ where: { employeeId: id, checkOut: null }, orderBy: { checkIn: "desc" } });
    if (!open) throw new ValidationError("notCheckedIn");
    const now = new Date();
    await db.attendance.update({ where: { id: open.id }, data: { checkOut: now } });
    const hours = Math.round(((now.getTime() - open.checkIn.getTime()) / 3_600_000) * 10) / 10;
    await audit(s.uid, "CHECK_OUT", "Employee", id, { hours });
    refresh();
    return { hours };
  });
}

// ---------- Авансы, штрафы, премии, выплаты (владелец) ----------

export async function addAdjustment(input: { employeeId: number; type: string; amount: string; comment?: string; fromCash?: boolean }) {
  return run(async () => {
    const s = await requireSession(["OWNER"]);
    const type = oneOf(input.type, ["ADVANCE", "FINE", "BONUS", "PAYOUT"] as const);
    const amount = money(input.amount, { min: 1 });
    const comment = optStr(input.comment, 200);
    const employeeId = int(input.employeeId, { min: 1 });
    const fromCash = !!input.fromCash && (type === "ADVANCE" || type === "PAYOUT");

    const adj = await db.$transaction(async (tx) => {
      const e = await tx.employee.findUnique({ where: { id: employeeId } });
      if (!e) throw new ValidationError("notFound");
      if (fromCash) {
        // деньги выдали из кассы — это расход смены «Зарплата / аванс»
        const shift = await getOpenShift(tx);
        if (!shift) throw new ValidationError("noShift");
        if (amount > (await getShiftSummary(shift.id, tx)).expectedCash) throw new ValidationError("notEnoughCash");
        const text = `${type === "ADVANCE" ? "Аванс" : "Зарплата"}: ${e.name}${comment ? ` · ${comment}` : ""}`;
        const op = await tx.cashOperation.create({ data: { cashShiftId: shift.id, type: "EXPENSE", amount, category: "SALARY", comment: text, createdById: s.uid } });
        await tx.expense.create({ data: { category: "SALARY", amount, comment: text, cashOperationId: op.id, createdById: s.uid } });
      }
      return tx.salaryAdjustment.create({ data: { employeeId, type, amount, comment, createdById: s.uid } });
    });
    await audit(s.uid, `SALARY_${type}`, "Employee", employeeId, { amount, comment, fromCash });
    refresh();
    revalidatePath("/cash");
    return { id: adj.id };
  });
}

/**
 * Удалить ошибочную запись. Если деньги выдавались из кассы, расход смены остаётся —
 * наличные действительно ушли; при необходимости его правят внесением в кассу.
 */
export async function deleteAdjustment(id: number) {
  return run(async () => {
    const s = await requireSession(["OWNER"]);
    const a = await db.salaryAdjustment.findUnique({ where: { id: int(id, { min: 1 }) } });
    if (!a) throw new ValidationError("notFound");
    await db.salaryAdjustment.delete({ where: { id: a.id } });
    await audit(s.uid, "SALARY_ADJUSTMENT_DELETED", "Employee", a.employeeId, { type: a.type, amount: a.amount });
    refresh();
  });
}
