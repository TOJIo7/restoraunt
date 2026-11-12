// Форматирование чисел для интерфейса (без зависимостей от сервера).

/** 0.15 → "0,15"; 20 → "20"; 1234.5 → "1 234,5" */
export function formatQty(n: number) {
  const r = Math.round(n * 1000) / 1000;
  const [int, frac] = Math.abs(r).toString().split(".");
  const intStr = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${r < 0 ? "−" : ""}${intStr}${frac ? "," + frac : ""}`;
}

/** "0,15" / "20" → число; пусто или мусор → null */
export function parseQty(s: string): number | null {
  const clean = s.replace(/[\s ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,3})?$/.test(clean)) return null;
  return parseFloat(clean);
}

/** Время "14:05" и дата "12.11" */
export const hhmm = (iso: string | Date) => new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
export const ddmm = (iso: string | Date) => new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
