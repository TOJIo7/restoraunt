"use client";

import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";
import { formatMoney } from "@/lib/money";

/** Сумма, которая «прокручивается» к новому значению (≈250 мс, не мешает вводу). */
export function AnimatedMoney({ value, className = "", currency = true }: { value: number; className?: string; currency?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = prev.current;
    prev.current = value;
    if (reduce || from === value) {
      el.textContent = formatMoney(value, { currency });
      return;
    }
    const controls = animate(from, value, {
      duration: 0.25,
      ease: "easeOut",
      onUpdate: (v) => (el.textContent = formatMoney(Math.round(v), { currency })),
    });
    return () => controls.stop();
  }, [value, currency, reduce]);

  return (
    <span ref={ref} className={`num ${className}`}>
      {formatMoney(value, { currency })}
    </span>
  );
}
