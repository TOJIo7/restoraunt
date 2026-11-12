"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Ban, Search } from "lucide-react";
import { useI18n } from "@/components/Providers";
import { pickName } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import type { PickerMenu } from "@/lib/order-view";

type Dish = PickerMenu[number]["dishes"][number];

/** Плитки блюд для быстрого ввода: клик — блюдо в заказе. */
export function MenuPicker({ menu, onPick, disabled }: { menu: PickerMenu; onPick: (dish: Dish, el: HTMLElement) => void; disabled?: boolean }) {
  const { t, locale } = useI18n();
  const [cat, setCat] = useState<number | "all">(menu[0]?.id ?? "all");
  const [q, setQ] = useState("");

  const dishes = useMemo(() => {
    const query = q.trim().toLowerCase();
    // при поиске ищем по всему меню, не только в выбранной категории
    if (query) return menu.flatMap((c) => c.dishes).filter((d) => `${d.nameRu} ${d.nameTg}`.toLowerCase().includes(query));
    return cat === "all" ? menu.flatMap((c) => c.dishes) : (menu.find((c) => c.id === cat)?.dishes ?? []);
  }, [menu, cat, q]);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-3 flex items-center gap-3">
        <div className="relative w-64 shrink-0">
          <Search size={18} strokeWidth={1.75} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.menu.search}
            className="h-12 w-full rounded-[var(--radius-btn)] border border-line bg-surface pl-11 pr-4 placeholder:text-muted/70 focus:border-saffron focus:outline-none"
          />
        </div>
      </div>
      <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
        {menu.map((c) => {
          const on = !q && cat === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCat(c.id);
                setQ("");
              }}
              className={`relative h-11 shrink-0 rounded-[var(--radius-btn)] px-3.5 text-sm font-medium transition-colors ${
                on ? "text-on-saffron" : "text-muted hover:bg-surface-2 hover:text-text"
              }`}
            >
              {on && <motion.span layoutId="picker-cat" className="absolute inset-0 rounded-[var(--radius-btn)] bg-saffron" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
              <span className="relative">{pickName(c, locale)}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] content-start gap-2.5 overflow-y-auto pb-4 pr-1">
        {dishes.map((d) => {
          const name = pickName(d, locale);
          return (
            <button
              key={d.id}
              type="button"
              disabled={disabled || d.inStopList}
              onClick={(e) => onPick(d, e.currentTarget)}
              className="group relative flex h-[92px] flex-col justify-between rounded-[var(--radius-btn)] border border-line bg-surface p-3 text-left transition-[background-color,border-color,transform] duration-150 hover:border-saffron/50 hover:bg-surface-2 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="line-clamp-2 text-[15px] font-medium leading-snug">{name}</span>
              <span className="flex items-center justify-between">
                <span className="num font-display font-semibold text-saffron">{formatMoney(d.price, { currency: false })}</span>
                {d.inStopList && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-pomegranate">
                    <Ban size={12} strokeWidth={2} />
                    {t.menu.stopList}
                  </span>
                )}
              </span>
            </button>
          );
        })}
        {dishes.length === 0 && <p className="col-span-full py-10 text-center text-muted">{t.menu.empty}</p>}
      </div>
    </div>
  );
}
