"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n";
import { THEME_COOKIE, type Theme } from "@/lib/i18n/server";

const YEAR = 60 * 60 * 24 * 365;

export async function setLocale(locale: Locale) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: YEAR, sameSite: "lax" });
}

export async function setTheme(theme: Theme) {
  (await cookies()).set(THEME_COOKIE, theme === "light" ? "light" : "dark", { path: "/", maxAge: YEAR, sameSite: "lax" });
}
