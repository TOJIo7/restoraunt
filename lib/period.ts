// Периоды для отчётов и зарплаты. Всё в местном времени кассового компьютера.

export const PERIODS = ["today", "week", "month", "custom"] as const;
export type Period = (typeof PERIODS)[number];

export function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Понедельник недели, в которую попадает дата. */
export function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // пн = 0
  return addDays(x, -day);
}

/** Диапазон [from, to) для периода. custom — даты YYYY-MM-DD включительно. */
export function periodRange(period: Period, from?: string, to?: string): { from: Date; to: Date } {
  const now = new Date();
  if (period === "today") return { from: startOfDay(now), to: addDays(startOfDay(now), 1) };
  if (period === "week") return { from: startOfWeek(now), to: addDays(startOfWeek(now), 7) };
  if (period === "month") return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  const f = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? new Date(`${from}T00:00:00`) : startOfDay(now);
  const t = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? addDays(new Date(`${to}T00:00:00`), 1) : addDays(f, 1);
  return t > f ? { from: f, to: t } : { from: f, to: addDays(f, 1) };
}

/** "2026-11" → [1 ноября, 1 декабря) */
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) {
    const now = new Date();
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  }
  return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1) };
}

export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
