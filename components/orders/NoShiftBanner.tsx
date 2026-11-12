"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";
import { useI18n } from "@/components/Providers";

export function NoShiftBanner() {
  const { t } = useI18n();
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-[var(--radius-card)] border border-apricot/45 bg-apricot/10 px-5 py-4">
      <Wallet size={22} strokeWidth={1.75} className="text-apricot" />
      <div className="flex-1">
        <div className="font-semibold">{t.orders.noShiftTitle}</div>
        <div className="text-sm text-muted">{t.orders.noShiftText}</div>
      </div>
      <Link
        href="/cash"
        className="inline-flex h-12 items-center rounded-[var(--radius-btn)] bg-saffron px-5 font-semibold text-on-saffron transition-[filter,transform] hover:brightness-110 active:scale-[0.97]"
      >
        {t.orders.openShift}
      </Link>
    </div>
  );
}
