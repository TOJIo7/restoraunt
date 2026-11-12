"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useI18n } from "@/components/Providers";
import { Button } from "@/components/ui/Button";

/** Выбор периода: сегодня / неделя / месяц / свой диапазон. Один ряд над тем, что он фильтрует. */
export function PeriodPicker({ base, period, from, to }: { base: string; period: string; from: string; to: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [f, setF] = useState(from);
  const [tt, setT] = useState(to);
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {(["today", "week", "month"] as const).map((p) => (
        <Link
          key={p}
          href={`${base}&period=${p}`}
          className={`relative inline-flex h-11 items-center rounded-[var(--radius-btn)] px-4 text-sm font-medium transition-colors ${period === p ? "text-on-saffron" : "text-muted hover:bg-surface-2 hover:text-text"}`}
        >
          {period === p && <motion.span layoutId={`period-${base}`} className="absolute inset-0 rounded-[var(--radius-btn)] bg-saffron" />}
          <span className="relative">{t.staff.period[p]}</span>
        </Link>
      ))}
      <div className={`ml-2 flex items-center gap-2 rounded-[var(--radius-btn)] border px-2 py-1 ${period === "custom" ? "border-saffron/50" : "border-line"}`}>
        <span className="text-sm text-muted">{t.staff.from}</span>
        <input type="date" value={f} onChange={(e) => setF(e.target.value)} className="h-9 rounded-lg bg-surface-2 px-2 text-sm" />
        <span className="text-sm text-muted">{t.staff.to}</span>
        <input type="date" value={tt} onChange={(e) => setT(e.target.value)} className="h-9 rounded-lg bg-surface-2 px-2 text-sm" />
        <Button size="sm" variant="ghost" onClick={() => router.push(`${base}&period=custom&from=${f}&to=${tt}`)}>
          OK
        </Button>
      </div>
    </div>
  );
}
