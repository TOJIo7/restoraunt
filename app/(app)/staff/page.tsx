import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { computePayroll, waiterSales } from "@/lib/payroll";
import { addDays, currentMonth, monthRange, PERIODS, periodRange, startOfDay, startOfWeek, ymd, type Period } from "@/lib/period";
import { StaffClient, type StaffTab } from "./StaffClient";

const OWNER_TABS: StaffTab[] = ["team", "schedule", "attendance", "payroll", "sales"];
const CASHIER_TABS: StaffTab[] = ["attendance", "schedule", "team"];

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; week?: string; month?: string; period?: string; from?: string; to?: string }>;
}) {
  const session = await requireSession();
  const isOwner = session.role === "OWNER";
  const sp = await searchParams;
  const tabs = isOwner ? OWNER_TABS : CASHIER_TABS;
  const tab: StaffTab = tabs.includes(sp.tab as StaffTab) ? (sp.tab as StaffTab) : tabs[0];

  const employees = await db.employee.findMany({
    where: { active: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { user: { select: { role: true, active: true } } },
  });
  const team = employees.map((e) => ({
    id: e.id,
    name: e.name,
    position: e.position,
    phone: e.phone,
    // деньги видит только владелец
    payType: isOwner ? e.payType : "",
    salary: isOwner ? e.salary : 0,
    rate: isOwner ? e.rate : 0,
    salesPercentBp: isOwner ? e.salesPercentBp : 0,
    hasLogin: !!e.user?.active,
  }));

  let extra: Record<string, unknown> = {};

  if (tab === "schedule") {
    const base = sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? new Date(`${sp.week}T12:00:00`) : new Date();
    const weekStart = startOfWeek(isNaN(base.getTime()) ? new Date() : base);
    const shifts = await db.shift.findMany({ where: { startsAt: { gte: weekStart, lt: addDays(weekStart, 7) } } });
    extra = {
      weekStart: ymd(weekStart),
      shifts: shifts.map((s) => ({ employeeId: s.employeeId, date: ymd(s.startsAt), start: s.startsAt.toISOString(), end: s.endsAt.toISOString() })),
    };
  }

  if (tab === "attendance") {
    const today = startOfDay(new Date());
    const weekStart = startOfWeek(today);
    const [todayShifts, open, log] = await Promise.all([
      db.shift.findMany({ where: { startsAt: { gte: today, lt: addDays(today, 1) } } }),
      db.attendance.findMany({ where: { checkOut: null } }),
      db.attendance.findMany({
        where: { checkIn: { gte: weekStart } },
        orderBy: { checkIn: "desc" },
        include: { employee: { select: { name: true } } },
        take: 80,
      }),
    ]);
    extra = {
      todayShifts: todayShifts.map((s) => ({ employeeId: s.employeeId, start: s.startsAt.toISOString(), end: s.endsAt.toISOString() })),
      open: open.map((a) => ({ employeeId: a.employeeId, checkIn: a.checkIn.toISOString(), lateMinutes: a.lateMinutes })),
      log: log.map((a) => ({
        id: a.id,
        name: a.employee.name,
        checkIn: a.checkIn.toISOString(),
        checkOut: a.checkOut?.toISOString() ?? null,
        lateMinutes: a.lateMinutes,
      })),
    };
  }

  if (tab === "payroll") {
    const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : currentMonth();
    const { from, to } = monthRange(month);
    const [rows, adjustments] = await Promise.all([
      computePayroll(month),
      db.salaryAdjustment.findMany({ where: { date: { gte: from, lt: to } }, orderBy: { date: "desc" } }),
    ]);
    extra = {
      month,
      payroll: rows,
      adjustments: adjustments.map((a) => ({ id: a.id, employeeId: a.employeeId, type: a.type, amount: a.amount, comment: a.comment, date: a.date.toISOString() })),
    };
  }

  if (tab === "sales") {
    const period: Period = PERIODS.includes(sp.period as Period) ? (sp.period as Period) : "month";
    const { from, to } = periodRange(period, sp.from, sp.to);
    extra = { period, from: ymd(from), to: ymd(addDays(to, -1)), sales: await waiterSales(from, to) };
  }

  return <StaffClient tab={tab} tabs={tabs} isOwner={isOwner} team={team} {...extra} />;
}
