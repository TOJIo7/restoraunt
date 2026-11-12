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

const ruPlural = new Intl.PluralRules("ru-RU");

/**
 * Подставить параметры: fmt("Этап {n}", { n: 2 }) → "Этап 2".
 * Склонение по числу (русский): "{n} {n:гость|гостя|гостей}" → "1 гость", "3 гостя", "5 гостей".
 * В таджикском при числительном существительное не меняется — там формы не пишем.
 */
export function fmt(template: string, params: Record<string, string | number>) {
  return template
    .replace(/\{(\w+):([^}]+)\}/g, (_, k, forms: string) => {
      const [one, few, many] = forms.split("|");
      const rule = ruPlural.select(Number(params[k] ?? 0));
      return rule === "one" ? one : rule === "few" ? (few ?? one) : (many ?? few ?? one);
    })
    .replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

/** Название из БД на нужном языке (поля nameRu / nameTg). */
export function pickName(obj: { nameRu: string; nameTg: string }, locale: Locale) {
  return locale === "tg" ? obj.nameTg || obj.nameRu : obj.nameRu;
}
