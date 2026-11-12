"use client";

import { forwardRef, useState } from "react";
import { motion } from "motion/react";
import { Ban } from "lucide-react";
import { useAction, useI18n } from "@/components/Providers";
import { Switch } from "@/components/ui/Switch";
import { formatMoney } from "@/lib/money";
import { setStopList } from "@/app/actions/menu";
import type { MenuDish } from "./MenuClient";

// Цвет заглушки фото — по категории, из палитры (без радуги: 5 тёплых тонов)
const TONES = ["var(--saffron)", "var(--pomegranate)", "var(--mint)", "var(--apricot)", "var(--lapis)"];

export const DishCard = forwardRef<
  HTMLDivElement,
  { dish: MenuDish; index: number; categoryIndex: number; canEdit: boolean; onEdit: () => void }
>(function DishCard({ dish, index, categoryIndex, canEdit, onEdit }, ref) {
  const { t, locale } = useI18n();
  const [pending, act] = useAction();
  // оптимистично: переключатель реагирует сразу, сервер догоняет
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const stopped = optimistic ?? dish.inStopList;

  const name = locale === "tg" ? dish.nameTg : dish.nameRu;
  const altName = locale === "tg" ? dish.nameRu : dish.nameTg;
  // без перевода описание не показываем — не смешиваем языки на одном экране
  const desc = locale === "tg" ? dish.descriptionTg : dish.descriptionRu;
  const toneIndex = Math.max(categoryIndex, 0) % TONES.length;

  const toggle = (available: boolean) => {
    setOptimistic(!available);
    act(() => setStopList(dish.id, !available), { onOk: () => setOptimistic(null) });
  };

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2, delay: Math.min(index, 12) * 0.02 }}
      className={`group flex flex-col overflow-hidden rounded-[var(--radius-card)] border bg-surface transition-colors ${
        stopped ? "border-pomegranate/40" : "border-line hover:border-saffron/40"
      }`}
    >
      <button
        type="button"
        onClick={canEdit ? onEdit : undefined}
        className={`relative flex flex-1 flex-col text-left ${canEdit ? "cursor-pointer" : "cursor-default"}`}
        tabIndex={canEdit ? 0 : -1}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
          {dish.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dish.photo}
              alt={name}
              className={`h-full w-full object-cover transition-[transform,filter] duration-300 group-hover:scale-[1.03] ${stopped ? "grayscale" : ""}`}
            />
          ) : (
            <PhotoPlaceholder letter={name[0] ?? "?"} toneIndex={toneIndex} dim={stopped} />
          )}
          {stopped && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-pomegranate px-2.5 py-1 text-xs font-semibold text-on-pomegranate">
              <Ban size={13} strokeWidth={2} />
              {t.menu.stopList}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className={`font-semibold leading-snug ${stopped ? "text-muted" : ""}`}>{name}</div>
            <div className="num shrink-0 font-display text-lg font-semibold text-saffron">{formatMoney(dish.price, { currency: false })}</div>
          </div>
          {altName !== name && <div className="text-xs text-muted">{altName}</div>}
          {desc && <div className="mt-1 line-clamp-2 text-sm text-muted">{desc}</div>}
        </div>
      </button>
      <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
        <span className={`text-sm ${stopped ? "text-pomegranate" : "text-mint"}`}>{stopped ? t.menu.inStopList : t.menu.available}</span>
        <Switch checked={!stopped} onChange={toggle} disabled={pending} ariaLabel={t.menu.available} />
      </div>
    </motion.div>
  );
});

/** Заглушка вместо фото: тон категории, ромбы сюзане, крупная буква. */
function PhotoPlaceholder({ letter, toneIndex, dim }: { letter: string; toneIndex: number; dim: boolean }) {
  const tone = TONES[toneIndex];
  return (
    <div className={`absolute inset-0 flex items-center justify-center ${dim ? "opacity-50" : ""}`} style={{ color: tone }}>
      <svg className="absolute inset-0 h-full w-full opacity-[0.22]" aria-hidden>
        <defs>
          <pattern id={`ph-${toneIndex}`} width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M14 3 L24 14 L14 25 L4 14 Z" fill="none" stroke="currentColor" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#ph-${toneIndex})`} />
      </svg>
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 50%, color-mix(in srgb, ${tone} 22%, transparent), transparent 70%)` }} />
      <span className="relative font-display text-5xl font-semibold">{letter}</span>
    </div>
  );
}
