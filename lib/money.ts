// Деньги хранятся в дирамах (целые числа). 1 TJS = 100 дирам.

const NBSP = " ";

/** 125050 → "1 250,50 TJS"; 125000 → "1 250 TJS" */
export function formatMoney(dirams: number, opts: { currency?: boolean } = {}): string {
  const sign = dirams < 0 ? "−" : "";
  const abs = Math.abs(Math.round(dirams));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const body = frac ? `${wholeStr},${frac.toString().padStart(2, "0")}` : wholeStr;
  return `${sign}${body}${opts.currency === false ? "" : `${NBSP}TJS`}`;
}

/** "1 250,5" / "1250.50" → 125050. Возвращает null, если строка не число. */
export function parseMoney(input: string): number | null {
  const clean = input.replace(/[\s ]/g, "").replace(",", ".");
  if (clean === "" || !/^-?\d+(\.\d{0,2})?$/.test(clean)) return null;
  return Math.round(parseFloat(clean) * 100);
}

/** Процент в базисных пунктах: сумма * bp / 10000, округление до дирама. */
export function applyBp(dirams: number, bp: number): number {
  return Math.round((dirams * bp) / 10000);
}
