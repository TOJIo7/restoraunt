"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { setLocale, setTheme } from "@/app/actions/prefs";
import { useI18n } from "@/components/Providers";

export function PrefsToggles() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();

  const toggleTheme = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next; // мгновенно, без ожидания сервера
    start(() => setTheme(next));
  };

  const toggleLang = () => {
    start(async () => {
      await setLocale(locale === "ru" ? "tg" : "ru");
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggleLang}
        disabled={pending}
        title={t.common.language}
        className="flex h-10 items-center rounded-[var(--radius-btn)] border border-line bg-surface p-1 text-xs font-semibold"
      >
        {(["ru", "tg"] as const).map((l) => (
          <span
            key={l}
            className={`rounded-lg px-2.5 py-1.5 transition-colors ${locale === l ? "bg-saffron/15 text-saffron" : "text-muted"}`}
          >
            {l === "ru" ? "RU" : "TJ"}
          </span>
        ))}
      </button>
      <button
        type="button"
        onClick={toggleTheme}
        className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-btn)] border border-line bg-surface text-muted transition-colors hover:text-text"
        title={`${t.common.themeDark} / ${t.common.themeLight}`}
      >
        <Sun size={18} strokeWidth={1.75} className="hidden [[data-theme=dark]_&]:block" />
        <Moon size={18} strokeWidth={1.75} className="hidden [[data-theme=light]_&]:block" />
      </button>
    </div>
  );
}
