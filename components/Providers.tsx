"use client";

import { createContext, useContext } from "react";
import { MotionConfig } from "motion/react";
import type { Dict, Locale } from "@/lib/i18n";

const I18nContext = createContext<{ locale: Locale; t: Dict } | null>(null);

export function Providers({ locale, t, children }: { locale: Locale; t: Dict; children: React.ReactNode }) {
  return (
    <I18nContext.Provider value={{ locale, t }}>
      {/* reducedMotion="user": уважаем системную настройку «уменьшить движение» */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n вне Providers");
  return ctx;
}
