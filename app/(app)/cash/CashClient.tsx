"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Lock, ShoppingCart, Wallet } from "lucide-react";
import { useAction, useI18n } from "@/components/Providers";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { FieldLabel, Select } from "@/components/ui/Field";
import { AnimatedMoney } from "@/components/ui/AnimatedMoney";
import { fmt } from "@/lib/i18n";
import { formatMoney, parseMoney } from "@/lib/money";
import { EXPENSE_CATEGORIES } from "@/lib/orders";
import { addCashOperation, closeShift, openShift } from "@/app/actions/cash";
import type { ShiftSummary } from "@/lib/cash";

type Shift = { id: number; openedAt: string; openingCash: number; openedBy: string; summary: ShiftSummary };
type Op = { id: number; type: string; amount: number; category: string | null; comment: string | null; by: string; at: string };
type Hist = { id: number; openedAt: string; closedAt: string; openedBy: string; closedBy: string; expected: number; actual: number; difference: number };

const time = (iso: string) => new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
const dateTime = (iso: string) => `${new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })} ${time(iso)}`;

export function CashClient({ shift, operations, openOrders, history, isOwner }: { shift: Shift | null; operations: Op[]; openOrders: number; history: Hist[]; isOwner: boolean }) {
  const { t } = useI18n();
  const [closedResult, setClosedResult] = useState<{ expected: number; actual: number; difference: number } | null>(null);

  return (
    <>
      <PageHeader title={t.nav.cash} subtitle={shift ? fmt(t.cash.openedBy, { name: shift.openedBy, t: dateTime(shift.openedAt) }) : undefined} />
      {shift ? <OpenShiftView shift={shift} operations={operations} openOrders={openOrders} onClosed={setClosedResult} /> : <OpenShiftForm />}

      {isOwner && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-lg font-semibold">{t.cash.history}</h2>
          {history.length === 0 ? (
            <p className="text-muted">{t.cash.noHistory}</p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
              <table className="w-full text-sm">
                <thead className="bg-surface text-left text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">{t.receipt.date}</th>
                    <th className="px-4 py-3 font-medium">{t.receipt.cashier}</th>
                    <th className="px-4 py-3 text-right font-medium">{t.cash.expectedCash}</th>
                    <th className="px-4 py-3 text-right font-medium">{t.cash.actualCash.replace(", TJS", "")}</th>
                    <th className="px-4 py-3 text-right font-medium">{t.cash.difference}</th>
                  </tr>
                </thead>
                <tbody className="num">
                  {history.map((h) => (
                    <tr key={h.id} className="border-t border-line">
                      <td className="px-4 py-3 text-muted">{h.id}</td>
                      <td className="px-4 py-3">
                        {dateTime(h.openedAt)} — {time(h.closedAt)}
                      </td>
                      <td className="px-4 py-3">{h.closedBy}</td>
                      <td className="px-4 py-3 text-right">{formatMoney(h.expected)}</td>
                      <td className="px-4 py-3 text-right">{formatMoney(h.actual)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${h.difference < 0 ? "text-pomegranate" : h.difference > 0 ? "text-apricot" : "text-mint"}`}>
                        {h.difference > 0 ? "+" : ""}
                        {formatMoney(h.difference)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {closedResult && (
        <Modal open onClose={() => setClosedResult(null)} title={t.cash.closedTitle} width={460} footer={<Button variant="primary" onClick={() => setClosedResult(null)}>{t.pay.done}</Button>}>
          <DiffSummary {...closedResult} />
        </Modal>
      )}
    </>
  );
}

function OpenShiftForm() {
  const { t } = useI18n();
  const [pending, act] = useAction();
  const [value, setValue] = useState("");
  const amount = parseMoney(value);
  return (
    <Card className="max-w-lg p-8">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-saffron/12 text-saffron">
        <Wallet size={28} strokeWidth={1.75} />
      </div>
      <h2 className="font-display text-2xl font-semibold">{t.cash.openTitle}</h2>
      <p className="mb-6 mt-2 text-muted">{t.cash.openText}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (amount !== null) act(() => openShift(amount), { success: t.cash.shiftOpen });
        }}
        className="flex items-end gap-3"
      >
        <Input label={t.cash.openingCash} value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="500" className="num w-44 font-display text-xl" autoFocus />
        <Button variant="primary" size="lg" type="submit" disabled={pending || amount === null}>
          {t.cash.open}
        </Button>
      </form>
    </Card>
  );
}

function OpenShiftView({ shift, operations, openOrders, onClosed }: { shift: Shift; operations: Op[]; openOrders: number; onClosed: (r: { expected: number; actual: number; difference: number }) => void }) {
  const { t } = useI18n();
  const s = shift.summary;
  const [opType, setOpType] = useState<"EXPENSE" | "DEPOSIT" | "WITHDRAWAL" | null>(null);
  const [closing, setClosing] = useState(false);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-6">
        {/* Главная цифра — наличные в кассе; остальное спокойнее */}
        <Card className="relative overflow-hidden p-7">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,var(--glow),transparent_70%)]" />
          <div className="text-muted">{t.cash.expectedCash}</div>
          <AnimatedMoney value={s.expectedCash} className="mt-1 block font-display text-5xl font-semibold text-saffron" />
          <dl className="num mt-6 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
            <Stat label={t.cash.opening} value={shift.openingCash} />
            <Stat label={t.cash.cashSales} value={s.cashSales} sign="+" />
            <Stat label={t.cash.deposits} value={s.deposits} sign="+" />
            <Stat label={t.cash.withdrawals} value={s.withdrawals} sign="−" />
            <Stat label={t.cash.expenses} value={s.expenses} sign="−" />
            {s.prepayments !== 0 && <Stat label={t.cash.prepayments} value={s.prepaymentsCash} sign="+" />}
          </dl>
        </Card>

        <div className="grid grid-cols-3 gap-4">
          <Card className="p-5">
            <div className="text-sm text-muted">{t.cash.revenue}</div>
            <div className="num mt-1 font-display text-2xl font-semibold">{formatMoney(s.revenue)}</div>
          </Card>
          <Card className="p-5">
            <div className="text-sm text-muted">{t.cash.orders}</div>
            <div className="num mt-1 font-display text-2xl font-semibold">{s.ordersCount}</div>
          </Card>
          <Card className="p-5">
            <div className="text-sm text-muted">{t.cash.avgCheck}</div>
            <div className="num mt-1 font-display text-2xl font-semibold">{formatMoney(s.ordersCount ? Math.round(s.revenue / s.ordersCount) : 0)}</div>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-3 text-sm text-muted">{t.cash.byMethod}</h3>
            <Bars data={Object.entries(s.byMethod).map(([k, v]) => ({ label: t.payMethod[k as "CASH"], value: v }))} />
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 text-sm text-muted">{t.cash.byType}</h3>
            <Bars data={Object.entries(s.byType).map(([k, v]) => ({ label: t.orderType[k as "DINE_IN"], value: v }))} />
          </Card>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <Card className="p-5">
          <div className="mb-4 grid grid-cols-3 gap-2">
            <OpButton icon={<ShoppingCart size={20} strokeWidth={1.75} />} label={t.cash.expense} onClick={() => setOpType("EXPENSE")} />
            <OpButton icon={<ArrowDownToLine size={20} strokeWidth={1.75} />} label={t.cash.deposit} onClick={() => setOpType("DEPOSIT")} />
            <OpButton icon={<ArrowUpFromLine size={20} strokeWidth={1.75} />} label={t.cash.withdrawal} onClick={() => setOpType("WITHDRAWAL")} />
          </div>
          <h3 className="mb-2 text-sm text-muted">{t.cash.operations}</h3>
          {operations.length === 0 ? (
            <p className="py-4 text-sm text-muted/80">{t.cash.noOperations}</p>
          ) : (
            <ul className="flex max-h-[260px] flex-col overflow-y-auto">
              {operations.map((o) => (
                <li key={o.id} className="flex items-center gap-3 border-t border-line py-2.5 text-sm first:border-t-0">
                  <span className="num w-11 text-muted">{time(o.at)}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {o.type === "EXPENSE"
                      ? t.cash.expenseCategory[o.category as "OTHER"]
                      : o.type === "DEPOSIT"
                        ? t.cash.deposit
                        : o.type === "PREPAYMENT"
                          ? `${t.cash.prepayment} · ${t.payMethod[o.category as "CASH"] ?? ""}`
                          : o.type === "PREPAYMENT_REFUND"
                            ? t.cash.prepaymentRefund
                            : t.cash.withdrawal}
                    {o.comment && <span className="text-muted"> · {o.comment}</span>}
                  </span>
                  <span className={`num font-semibold ${o.type === "DEPOSIT" || o.type === "PREPAYMENT" ? "text-mint" : ""}`}>
                    {o.type === "DEPOSIT" || o.type === "PREPAYMENT" ? "+" : "−"}
                    {formatMoney(o.amount, { currency: false })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="mb-1 font-display text-lg font-semibold">{t.cash.closeTitle}</h3>
          {openOrders > 0 && <p className="mb-3 text-sm text-apricot">{fmt(t.cash.openOrdersWarn, { n: openOrders })}</p>}
          <Button variant="danger" size="lg" className="mt-2 w-full" onClick={() => setClosing(true)}>
            <Lock size={18} strokeWidth={1.75} />
            {t.cash.close}
          </Button>
        </Card>
      </div>

      {opType && <CashOpModal type={opType} max={s.expectedCash} onClose={() => setOpType(null)} />}
      {closing && <CloseShiftModal expected={s.expectedCash} onClose={() => setClosing(false)} onClosed={onClosed} />}
    </div>
  );
}

function Stat({ label, value, sign }: { label: string; value: number; sign?: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold">
        {sign && value > 0 ? `${sign} ` : ""}
        {formatMoney(value, { currency: false })}
      </dd>
    </div>
  );
}

function Bars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {data.map((d) => (
        <li key={d.label} className="text-sm">
          <div className="mb-1 flex justify-between">
            <span>{d.label}</span>
            <span className="num font-semibold">{formatMoney(d.value, { currency: false })}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-saffron transition-[width] duration-500" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function OpButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-16 flex-col items-center justify-center gap-1 rounded-[var(--radius-btn)] border border-line bg-surface-2 text-sm font-medium transition-[background-color,transform] hover:bg-line/60 active:scale-[0.97]"
    >
      {icon}
      {label}
    </button>
  );
}

function CashOpModal({ type, max, onClose }: { type: "EXPENSE" | "DEPOSIT" | "WITHDRAWAL"; max: number; onClose: () => void }) {
  const { t } = useI18n();
  const [pending, act] = useAction();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("PURCHASE");
  const [comment, setComment] = useState("");
  const value = parseMoney(amount);
  const tooMuch = type !== "DEPOSIT" && value !== null && value > max;
  const title = type === "EXPENSE" ? t.cash.expense : type === "DEPOSIT" ? t.cash.deposit : t.cash.withdrawal;

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      width={480}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button
            variant="primary"
            disabled={pending || !value || value <= 0 || tooMuch}
            onClick={() => act(() => addCashOperation({ type, amount: value!, category: type === "EXPENSE" ? category : null, comment }), { success: t.common.saved, onOk: onClose })}
          >
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <Input label={`${t.pay.amount}, TJS`} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="num w-44 font-display text-xl" autoFocus />
        {tooMuch && <p className="-mt-2 text-sm text-pomegranate">{t.errors.notEnoughCash}</p>}
        {type === "EXPENSE" && (
          <FieldLabel label={t.cash.category}>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t.cash.expenseCategory[c]}
                </option>
              ))}
            </Select>
          </FieldLabel>
        )}
        <Input label={t.orders.comment} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={200} placeholder={t.cash.commentPlaceholder} />
      </div>
    </Modal>
  );
}

function CloseShiftModal({ expected, onClose, onClosed }: { expected: number; onClose: () => void; onClosed: (r: { expected: number; actual: number; difference: number }) => void }) {
  const { t } = useI18n();
  const [pending, act] = useAction();
  const [value, setValue] = useState("");
  const [comment, setComment] = useState("");
  const actual = parseMoney(value);

  return (
    <Modal
      open
      onClose={onClose}
      title={t.cash.closeTitle}
      width={500}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button
            variant="danger"
            disabled={pending || actual === null}
            onClick={() =>
              act(() => closeShift(actual!, comment), {
                onOk: (r) => {
                  onClose();
                  if (r) onClosed(r);
                },
              })
            }
          >
            <Lock size={18} strokeWidth={1.75} />
            {t.cash.close}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <div className="flex items-baseline justify-between">
          <span className="text-muted">{t.cash.expectedCash}</span>
          <span className="num font-display text-2xl font-semibold">{formatMoney(expected)}</span>
        </div>
        <Input label={t.cash.actualCash} value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" className="num w-48 font-display text-xl" autoFocus />
        {actual !== null && <DiffSummary expected={expected} actual={actual} difference={actual - expected} compact />}
        <Input label={t.orders.comment} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} />
      </div>
    </Modal>
  );
}

function DiffSummary({ expected, actual, difference, compact }: { expected: number; actual: number; difference: number; compact?: boolean }) {
  const { t } = useI18n();
  const label = difference < 0 ? t.cash.shortage : difference > 0 ? t.cash.surplus : t.cash.exact;
  const cls = difference < 0 ? "border-pomegranate/40 bg-pomegranate/10 text-pomegranate" : difference > 0 ? "border-apricot/40 bg-apricot/10 text-apricot" : "border-mint/40 bg-mint/10 text-mint";
  return (
    <div className="flex flex-col gap-3">
      {!compact && (
        <dl className="num flex flex-col gap-1.5">
          <div className="flex justify-between">
            <dt className="text-muted">{t.cash.expectedCash}</dt>
            <dd className="font-semibold">{formatMoney(expected)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">{t.cash.actualCash.replace(", TJS", "")}</dt>
            <dd className="font-semibold">{formatMoney(actual)}</dd>
          </div>
        </dl>
      )}
      <div className={`flex items-baseline justify-between rounded-[var(--radius-card)] border px-5 py-4 ${cls}`}>
        <span className="font-medium">
          {t.cash.difference}: {label}
        </span>
        <span className="num font-display text-2xl font-semibold">
          {difference > 0 ? "+" : ""}
          {formatMoney(difference)}
        </span>
      </div>
    </div>
  );
}
