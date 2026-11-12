// Простая проверка входных данных для server actions.
// Ошибка — это ключ из словаря t.errors, текст подставляет интерфейс.

export class ValidationError extends Error {
  constructor(public key: string) {
    super(key);
  }
}

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/** Обернуть действие: ValidationError → {ok:false}, остальные ошибки пробрасываются. */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, error: e.key };
    throw e;
  }
}

export function reqStr(v: unknown, max = 200): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) throw new ValidationError("required");
  if (s.length > max) throw new ValidationError("tooLong");
  return s;
}

export function optStr(v: unknown, max = 500): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (s.length > max) throw new ValidationError("tooLong");
  return s || null;
}

export function int(v: unknown, { min = 0, max = 1_000_000_000 } = {}): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new ValidationError("badNumber");
  return n;
}

/** Деньги из формы ("12,50" TJS) → дирамы */
export function money(v: unknown, { min = 0 } = {}): number {
  const s = String(v ?? "").replace(/[\s ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new ValidationError("badMoney");
  const n = Math.round(parseFloat(s) * 100);
  if (n < min) throw new ValidationError("badMoney");
  return n;
}

export function oneOf<T extends string>(v: unknown, list: readonly T[]): T {
  if (typeof v !== "string" || !list.includes(v as T)) throw new ValidationError("badValue");
  return v as T;
}
