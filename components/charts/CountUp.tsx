"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";
import { formatMoney } from "@/lib/money";

/** Число «набегает» от 0 до значения при появлении на экране (отчёты: 400–800 мс). */
export function CountUp({
  value,
  money = true,
  currency = true,
  suffix = "",
  className = "",
  duration = 0.8,
}: {
  value: number;
  money?: boolean;
  currency?: boolean;
  suffix?: string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const from = useRef(0);
  const format = (v: number) => (money ? formatMoney(Math.round(v), { currency }) : Math.round(v).toLocaleString("ru-RU").replace(/\s/g, " ")) + suffix;

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    if (reduce) {
      el.textContent = format(value);
      return;
    }
    const c = animate(from.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => (el.textContent = format(v)),
    });
    from.current = value;
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- format зависит только от пропсов ниже
  }, [value, inView, reduce, money, currency, suffix, duration]);

  // до появления на экране показываем 0 — потом набегает
  return (
    <span ref={ref} className={className}>
      {format(0)}
    </span>
  );
}
