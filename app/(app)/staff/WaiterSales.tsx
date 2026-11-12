"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useI18n } from "@/components/Providers";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/Ornament";
import { formatMoney } from "@/lib/money";
import { Avatar } from "./Team";

export type SalesRow = { waiterId: number | null; name: string | null; orders: number; total: number; sales: number; avg: number };

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

export function WaiterSales({ period, from, to, rows }: { period: string; from: string; to: string; rows: SalesRow[] }) {
  const { t } = useI18n();
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <>
      <PeriodPicker base="/staff?tab=sales" period={period} from={from} to={to} />
      {rows.length === 0 ? (
        <EmptyState title={t.orders.empty} text="" />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full text-[15px]">
            <thead className="bg-surface text-sm text-muted">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t.orders.waiter}</th>
                <th className="px-4 py-3 text-right font-medium">{t.staff.orders}</th>
                <th className="px-4 py-3 text-right font-medium">{t.staff.total}</th>
                <th className="px-4 py-3 text-right font-medium">{t.staff.avgCheck}</th>
                <th className="w-1/4 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="num">
              {rows.map((r, i) => (
                <tr key={r.waiterId ?? "none"} className="border-t border-line">
                  <td className="px-4 py-3 font-sans">
                    <div className="flex items-center gap-3">
                      {r.name ? <Avatar name={r.name} position="WAITER" size={34} /> : <span className="h-[34px] w-[34px]" />}
                      <span className={r.name ? "font-medium" : "text-muted"}>{r.name ?? t.staff.noWaiter}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">{r.orders}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatMoney(r.total, { currency: false })}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(r.avg, { currency: false })}</td>
                  <td className="px-4 py-3">
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <motion.div
                        className={`h-full rounded-full ${r.name ? "bg-saffron" : "bg-muted/40"}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${(r.total / max) * 100}%` }}
                        transition={{ duration: 0.6, delay: i * 0.06, ease: "easeOut" }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
