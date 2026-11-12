"use client";

import { useId, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { formatMoney } from "@/lib/money";

export type Column = { key: string; label: string; value: number; detail?: string };

/** Красивые деления оси: 0 / 1 000 / 2 000 … или 0 / 10K / 20K */
function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}
const tickLabel = (dirams: number) => {
  const tjs = dirams / 100;
  return tjs >= 10000 ? `${Math.round(tjs / 1000)}K` : Math.round(tjs).toLocaleString("ru-RU").replace(/\s/g, " ");
};

/**
 * Столбцы одной серии (выручка по дням/часам).
 * Тонкие столбцы ≤ 24px, скругление 4px сверху, растут снизу; сплошная тонкая сетка;
 * подсказка при наведении и фокусе с клавиатуры; подписан только максимум.
 */
export function ColumnChart({ data, height = 220, ariaLabel }: { data: Column[]; height?: number; ariaLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const id = useId();
  const max = Math.max(0, ...data.map((d) => d.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const maxIdx = data.findIndex((d) => d.value === max && max > 0);
  // подписи оси X прореживаем, чтобы не налезали
  const every = data.length > 16 ? Math.ceil(data.length / 10) : 1;
  const AXIS = 28;

  return (
    <div className="relative" role="figure" aria-label={ariaLabel}>
      <div className="flex" style={{ height: height + AXIS }}>
        {/* ось Y */}
        <div className="num relative w-12 shrink-0 text-right text-[11px] text-muted" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-2 -translate-y-1/2" style={{ top: `${(1 - t / top) * 100}%` }}>
              {tickLabel(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {/* сетка: сплошные волоски, на шаг от поверхности */}
          <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height }}>
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 h-px bg-line/70" style={{ top: `${(1 - t / top) * 100}%` }} />
            ))}
          </div>
          <div className="absolute inset-x-0 top-0 flex items-end" style={{ height }} onMouseLeave={() => setHover(null)}>
            {data.map((d, i) => {
              const h = (d.value / top) * 100;
              return (
                <div
                  key={d.key}
                  // зона наведения — весь столбец-слот, а не только закрашенные пиксели
                  className="relative flex h-full flex-1 cursor-default items-end justify-center outline-none"
                  tabIndex={0}
                  aria-label={`${d.label}: ${formatMoney(d.value)}${d.detail ? `, ${d.detail}` : ""}`}
                  aria-describedby={hover === i ? `${id}-tip` : undefined}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                >
                  {hover === i && <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-muted/35" />}
                  <motion.div
                    className="relative w-[70%] max-w-[24px] rounded-t-[4px]"
                    style={{ background: "var(--chart-1)", opacity: hover === null || hover === i ? 1 : 0.55 }}
                    initial={reduce ? false : { height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 0.6, delay: reduce ? 0 : Math.min(i, 30) * 0.015, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {i === maxIdx && (
                      <span className="num absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-text">
                        {tickLabel(d.value)}
                      </span>
                    )}
                  </motion.div>
                </div>
              );
            })}
          </div>
          {/* ось X */}
          <div className="num absolute inset-x-0 flex text-[11px] text-muted" style={{ top: height + 8 }}>
            {data.map((d, i) => (
              <span key={d.key} className="flex-1 text-center">
                {i % every === 0 ? d.label : ""}
              </span>
            ))}
          </div>
          {hover !== null && data[hover] && (
            <div
              id={`${id}-tip`}
              role="tooltip"
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-[var(--radius-btn)] border border-line bg-surface px-3 py-2 shadow-lg"
              style={{ left: `${((hover + 0.5) / data.length) * 100}%`, top: 4 }}
            >
              <div className="num font-display text-base font-semibold">{formatMoney(data[hover].value)}</div>
              <div className="whitespace-nowrap text-xs text-muted">
                {data[hover].label}
                {data[hover].detail ? ` · ${data[hover].detail}` : ""}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
