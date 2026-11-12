"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Trash2, Wallet } from "lucide-react";
import { useAction, useI18n } from "@/components/Providers";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { fmt } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { ddmm } from "@/lib/format";
import { addAdjustment, deleteAdjustment } from "@/app/actions/staff";
import type { PayrollRow } from "@/lib/payroll";
import { Avatar } from "./Team";

export type AdjustmentRow = { id: number; employeeId: number; type: string; amount: number; comment: string | null; date: string };

const shiftMonth = (m: string, n: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const money = (v: number) => (v ? formatMoney(v, { currency: false }) : "—");

export function Payroll({ month, rows, adjustments }: { month: string; rows: PayrollRow[]; adjustments: AdjustmentRow[] }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState<PayrollRow | null>(null);
  const [y, m] = month.split("-").map(Number);
  const title = new Date(y, m - 1, 1).toLocaleDateString(locale === "tg" ? "tg-TJ" : "ru-RU", { month: "long", year: "numeric" });
  const totalDue = rows.reduce((s, r) => s + Math.max(r.due, 0), 0);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/staff?tab=payroll&month=${shiftMonth(month, -1)}`} className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-btn)] border border-line text-muted hover:text-text" aria-label="←">
          <ChevronLeft size={20} />
        </Link>
        <span className="min-w-[180px] text-center font-display text-lg font-semibold capitalize">{title}</span>
        <Link href={`/staff?tab=payroll&month=${shiftMonth(month, 1)}`} className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-btn)] border border-line text-muted hover:text-text" aria-label="→">
          <ChevronRight size={20} />
        </Link>
        <span className="num ml-auto">
          <span className="text-muted">{t.staff.totalDue} </span>
          <span className="font-display text-2xl font-semibold text-saffron">{formatMoney(totalDue)}</span>
        </span>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-surface text-right text-muted">
            <tr>
              <th className="px-4 py-3 text-left font-medium" />
              <th className="px-3 py-3 font-medium">{t.staff.base}</th>
              <th className="px-3 py-3 font-medium">{t.staff.salesBonus}</th>
              <th className="px-3 py-3 font-medium">{t.staff.bonuses}</th>
              <th className="px-3 py-3 font-medium">{t.staff.fines}</th>
              <th className="px-3 py-3 font-medium">{t.staff.earned}</th>
              <th className="px-3 py-3 font-medium">{t.staff.advances}</th>
              <th className="px-3 py-3 font-medium">{t.staff.payouts}</th>
              <th className="px-4 py-3 font-medium">{t.staff.due}</th>
            </tr>
          </thead>
          <tbody className="num text-right">
            {rows.map((r) => (
              <tr key={r.employeeId} onClick={() => setOpen(r)} className="cursor-pointer border-t border-line transition-colors hover:bg-surface-2">
                <td className="px-4 py-3 text-left font-sans">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.name} position={r.position} size={34} />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.name}</div>
                      <div className="text-xs text-muted">
                        {t.positions[r.position as "WAITER"]} · {r.payType === "MONTHLY" ? t.payTypes.MONTHLY : r.payType === "PER_SHIFT" ? `${r.shifts} ${t.staff.shifts.toLowerCase()}` : `${r.hours} ${t.staff.hours.toLowerCase()}`}
                        {r.lateCount > 0 && <span className="text-apricot"> · {fmt(t.staff.lateCount, { n: r.lateCount, m: r.lateMinutes })}</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">{money(r.base)}</td>
                <td className="px-3 py-3">
                  {r.salesBonus ? (
                    <span title={`${formatMoney(r.sales)} × ${r.salesPercentBp / 100}%`}>
                      {money(r.salesBonus)}
                      <span className="block text-xs text-muted">{formatMoney(r.sales, { currency: false })} × {r.salesPercentBp / 100}%</span>
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-3 text-mint">{r.bonuses ? `+${money(r.bonuses)}` : "—"}</td>
                <td className="px-3 py-3 text-pomegranate">{r.fines ? `−${money(r.fines)}` : "—"}</td>
                <td className="px-3 py-3 font-semibold">{money(r.earned)}</td>
                <td className="px-3 py-3">{r.advances ? `−${money(r.advances)}` : "—"}</td>
                <td className="px-3 py-3">{r.payouts ? `−${money(r.payouts)}` : "—"}</td>
                <td className={`px-4 py-3 font-display text-base font-semibold ${r.due > 0 ? "text-saffron" : "text-muted"}`}>{formatMoney(r.due, { currency: false })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <EmployeePayroll
          row={rows.find((r) => r.employeeId === open.employeeId) ?? open}
          adjustments={adjustments.filter((a) => a.employeeId === open.employeeId)}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

const TYPES = ["ADVANCE", "FINE", "BONUS", "PAYOUT"] as const;
const toInput = (d: number) => (d % 100 ? (d / 100).toFixed(2).replace(".", ",") : String(d / 100));

function EmployeePayroll({ row, adjustments, onClose }: { row: PayrollRow; adjustments: AdjustmentRow[]; onClose: () => void }) {
  const { t } = useI18n();
  const [pending, act] = useAction();
  const [type, setType] = useState<(typeof TYPES)[number]>("ADVANCE");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [fromCash, setFromCash] = useState(true);
  const cashable = type === "ADVANCE" || type === "PAYOUT";

  const lines: [string, number, string?][] = [
    [
      `${t.staff.base}${row.payType === "PER_SHIFT" ? ` (${row.shifts} × ${formatMoney(row.rate, { currency: false })})` : row.payType === "HOURLY" ? ` (${row.hours} × ${formatMoney(row.rate, { currency: false })})` : ""}`,
      row.base,
    ],
    ...(row.salesPercentBp ? ([[`${t.staff.salesBonus} (${formatMoney(row.sales, { currency: false })} × ${row.salesPercentBp / 100}%)`, row.salesBonus]] as [string, number][]) : []),
    ...(row.bonuses ? ([[t.staff.bonuses, row.bonuses, "text-mint"]] as [string, number, string][]) : []),
    ...(row.fines ? ([[t.staff.fines, -row.fines, "text-pomegranate"]] as [string, number, string][]) : []),
  ];

  return (
    <Modal open onClose={onClose} title={row.name} width={620}>
      <div className="flex flex-col gap-5 pb-4">
        <dl className="num flex flex-col gap-1.5 text-[15px]">
          {lines.map(([label, v, cls]) => (
            <div key={label} className={`flex justify-between ${cls ?? ""}`}>
              <dt className="text-muted">{label}</dt>
              <dd>{formatMoney(v)}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-line pt-1.5 font-semibold">
            <dt>{t.staff.earned}</dt>
            <dd>{formatMoney(row.earned)}</dd>
          </div>
          {row.advances > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">{t.staff.advances}</dt>
              <dd>−{formatMoney(row.advances)}</dd>
            </div>
          )}
          {row.payouts > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">{t.staff.payouts}</dt>
              <dd>−{formatMoney(row.payouts)}</dd>
            </div>
          )}
          <div className="mt-1 flex items-baseline justify-between">
            <dt className="font-semibold">{t.staff.due}</dt>
            <dd className="font-display text-3xl font-semibold text-saffron">{formatMoney(row.due)}</dd>
          </div>
        </dl>

        {row.due > 0 && (
          <Button
            variant="primary"
            size="lg"
            disabled={pending}
            onClick={() => act(() => addAdjustment({ employeeId: row.employeeId, type: "PAYOUT", amount: toInput(row.due), fromCash: true }), { success: t.common.saved })}
          >
            <Wallet size={18} strokeWidth={1.75} />
            {fmt(t.staff.payoutDue, { sum: formatMoney(row.due) })}
          </Button>
        )}

        <section className="rounded-[var(--radius-card)] border border-line p-4">
          <h3 className="mb-3 text-sm text-muted">{t.staff.adjustment}</h3>
          <div className="mb-3 flex flex-wrap gap-2">
            {TYPES.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setType(x)}
                className={`h-10 rounded-[var(--radius-btn)] border px-3 text-sm transition-colors ${type === x ? "border-saffron bg-saffron/12 text-saffron" : "border-line bg-surface-2 hover:border-muted/50"}`}
              >
                {t.staff.adjTypes[x]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Input label={`${t.pay.amount}, TJS`} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="num w-32" />
            <div className="min-w-[180px] flex-1">
              <Input label={t.orders.comment} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={200} />
            </div>
            <Button
              disabled={pending || !amount}
              onClick={() =>
                act(() => addAdjustment({ employeeId: row.employeeId, type, amount, comment, fromCash: cashable && fromCash }), {
                  success: t.common.saved,
                  onOk: () => {
                    setAmount("");
                    setComment("");
                  },
                })
              }
            >
              {t.common.add}
            </Button>
          </div>
          {cashable && (
            <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm">
              <input type="checkbox" checked={fromCash} onChange={(e) => setFromCash(e.target.checked)} className="h-4 w-4 accent-[var(--saffron)]" />
              {t.staff.fromCash}
            </label>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm text-muted">{t.staff.history}</h3>
          {adjustments.length === 0 ? (
            <p className="text-sm text-muted/80">{t.staff.noHistory}</p>
          ) : (
            <ul className="num flex flex-col">
              {adjustments.map((a) => (
                <li key={a.id} className="group flex items-center gap-3 border-t border-line py-2 text-sm first:border-t-0">
                  <span className="w-12 text-muted">{ddmm(a.date)}</span>
                  <span className="min-w-0 flex-1 truncate font-sans">
                    {t.staff.adjTypes[a.type as "ADVANCE"]}
                    {a.comment && <span className="text-muted"> · {a.comment}</span>}
                  </span>
                  <span className={a.type === "BONUS" ? "text-mint" : a.type === "FINE" ? "text-pomegranate" : ""}>
                    {a.type === "BONUS" ? "+" : "−"}
                    {formatMoney(a.amount, { currency: false })}
                  </span>
                  <button
                    type="button"
                    onClick={() => act(() => deleteAdjustment(a.id))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted opacity-0 transition-opacity hover:bg-pomegranate/10 hover:text-pomegranate group-hover:opacity-100"
                    aria-label={t.common.delete}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}
