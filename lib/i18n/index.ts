import ru, { type Dict } from "./ru";
import tg from "./tg";

export type { Dict };
export const LOCALES = ["ru", "tg"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "lang";

export const dictionaries: Record<Locale, Dict> = { ru, tg };

export function isLocale(v: unknown): v is Locale {
  return v === "ru" || v === "tg";
}

/** Подставить параметры: fmt("Этап {n}", { n: 2 }) → "Этап 2" */
export function fmt(template: string, params: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

/** Название из БД на нужном языке (поля nameRu / nameTg). */
export function pickName(obj: { nameRu: string; nameTg: string }, locale: Locale) {
  return locale === "tg" ? obj.nameTg || obj.nameRu : obj.nameRu;
}
