"use client";

import { Children, isValidElement } from "react";
import { motion } from "motion/react";

/**
 * Появление при прокрутке: fade + сдвиг 24 px, один раз.
 * Для списков карточек — delay = index * 0.06 (60 мс между карточками).
 */
export function Reveal({
  children,
  delay = 0,
  as = "div",
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  as?: "div" | "li";
  className?: string;
}) {
  const C = as === "li" ? motion.li : motion.div;
  return (
    <C
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {children}
    </C>
  );
}

/** Обёртка для ряда блоков: каждый ребёнок появляется по очереди с шагом 60 мс. */
export function RevealStack({ children, className, step = 0.06 }: { children: React.ReactNode; className?: string; step?: number }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <div className={className}>
      {items.map((child, i) => (
        <Reveal key={isValidElement(child) && child.key != null ? child.key : i} delay={i * step} className="flex flex-col [&>*]:flex-1">
          {child}
        </Reveal>
      ))}
    </div>
  );
}
