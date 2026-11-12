"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { formatMoney } from "@/lib/money";

export type Part = { key: string; label: string; value: number };

/**
 * «Часть целого» (≤ 5 частей): высокая сегментированная полоса 28px + легенда-таблица.
 * Цвета по фиксированному порядку слотов (--chart-1…5) и закреплены за сущностью, а не за местом в рейтинге.
 * Блоки разделяет зазор 2px цвета поверхности; доля печатается внутри, только если помещается.
 */
export function Parts({ parts, ariaLabel }: { parts: Part[]; ariaLabel: string }) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<string | null>(null);
  const total = parts.reduce((s, p) => s + p.value, 0);
  const color = (i: number) => `var(--chart-${(i % 5) + 1})`;
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);

  return (
    <div role="figure" aria-label={ariaLabel}>
      <div className="flex h-7 gap-[2px] overflow-hidden rounded-[4px]">
        {total === 0 && <div className="h-full flex-1 rounded-[4px] bg-surface-2" />}
        {parts.map((p, i) =>
          p.value > 0 ? (
            <motion.div
              key={p.key}
              className="relative flex h-full items-center overflow-hidden rounded-[4px] first:rounded-l-[4px]"
              style={{ background: color(i), opacity: hover === null || hover === p.key ? 1 : 0.5 }}
              initial={reduce ? false : { flexGrow: 0 }}
              animate={{ flexGrow: p.value }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              onMouseEnter={() => setHover(p.key)}
              onMouseLeave={() => setHover(null)}
              tabIndex={0}
              onFocus={() => setHover(p.key)}
              onBlur={() => setHover(null)}
              aria-label={`${p.label}: ${formatMoney(p.value)}, ${pct(p.value)}%`}
              title={`${p.label}: ${formatMoney(p.value)} (${pct(p.value)}%)`}
            >
              {/* внутри — только если блок достаточно широкий (≥ 12%) */}
              {pct(p.value) >= 12 && <span className="num pl-2 text-xs font-semibold text-white">{pct(p.value)}%</span>}
            </motion.div>
          ) : null,
        )}
      </div>
      {/* легенда в порядке блоков + значения (таблица) */}
      <table className="mt-4 w-full text-sm">
        <tbody>
          {parts.map((p, i) => (
            <tr key={p.key} className={`transition-opacity ${hover && hover !== p.key ? "opacity-50" : ""}`} onMouseEnter={() => setHover(p.key)} onMouseLeave={() => setHover(null)}>
              <td className="w-5 py-1">
                <span className="block h-2.5 w-2.5 rounded-[3px]" style={{ background: color(i) }} />
              </td>
              <td className="py-1">{p.label}</td>
              <td className="num py-1 text-right font-semibold">{formatMoney(p.value, { currency: false })}</td>
              <td className="num w-14 py-1 text-right text-muted">{pct(p.value)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Рейтинг горизонтальными полосами (одна серия → один цвет). Значение — у конца полосы. */
export function RankBars({
  rows,
  ariaLabel,
  unit,
}: {
  rows: { key: string; label: string; value: number; sub?: string }[];
  ariaLabel: string;
  /** подпись вместо денег, например «шт» */
  unit?: string;
}) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-3" role="figure" aria-label={ariaLabel}>
      {rows.map((r, i) => (
        <li key={r.key} className="grid grid-cols-[minmax(120px,40%)_1fr] items-center gap-3 text-sm">
          <span className="truncate" title={r.label}>
            {r.label}
            {r.sub && <span className="text-muted"> · {r.sub}</span>}
          </span>
          <div className="flex items-center gap-2">
            <motion.div
              className="h-4 rounded-r-[4px]"
              style={{ background: "var(--chart-1)" }}
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${Math.max((r.value / max) * 82, r.value > 0 ? 1 : 0)}%` }}
              transition={{ duration: 0.6, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            />
            <span className="num shrink-0 text-xs font-semibold">{unit ? `${r.value.toLocaleString("ru-RU")} ${unit}` : formatMoney(r.value, { currency: false })}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
