"use client";

import { motion } from "motion/react";

export function Switch({
  checked,
  onChange,
  label,
  ariaLabel,
  disabled,
  tone = "saffron",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  /** подпись только для экранного диктора, когда видимый текст стоит рядом */
  ariaLabel?: string;
  disabled?: boolean;
  tone?: "saffron" | "pomegranate";
}) {
  const on = tone === "saffron" ? "bg-saffron" : "bg-pomegranate";
  return (
    <label className={`inline-flex cursor-pointer select-none items-center gap-3 ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel ?? label}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full border border-line transition-colors duration-200 ${checked ? on : "bg-surface-2"}`}
      >
        <motion.span
          className="absolute top-[3px] h-5 w-5 rounded-full bg-text shadow"
          animate={{ left: checked ? 24 : 3 }}
          transition={{ type: "spring", stiffness: 600, damping: 35 }}
        />
      </button>
      {label && <span className="text-[15px]">{label}</span>}
    </label>
  );
}
