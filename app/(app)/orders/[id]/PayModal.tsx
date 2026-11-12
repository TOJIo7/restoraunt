"use client";

import { useState } from "react";
import { ArrowLeftRight, Banknote, CreditCard, Plus, QrCode, Split, X } from "lucide-react";
import { useAction, useI18n } from "@/components/Providers";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatMoney, parseMoney } from "@/lib/money";
import { TRANSFER_PROVIDERS } from "@/lib/orders";
import type { PaymentMethod } from "@/lib/constants";
import { payOrder } from "@/app/actions/orders";
import type { OrderView } from "@/lib/order-view";

const METHODS: { id: PaymentMethod; icon: typeof Banknote }[] = [
  { id: "CASH", icon: Banknote },
  { id: "CARD", icon: CreditCard },
  { id: "TRANSFER", icon: ArrowLeftRight },
  { id: "QR", icon: QrCode },
];

type Line = { method: PaymentMethod; amount: string; received: string; provider: string };

/** "35,5" ← 3550 */
const toInput = (d: number) => (d % 100 ? (d / 100).toFixed(2).replace(".", ",") : String(d / 100));

/** Быстрые суммы «получено»: ровно и ближайшие круглые купюры. */
function quickCash(amount: number) {
  const steps = [1000, 2000, 5000, 10000, 20000, 50000]; // 10, 20, 50, 100, 200, 500 TJS
  const out = new Set<number>();
  for (const s of steps) {
    const v = Math.ceil(amount / s) * s;
    if (v > amount) out.add(v);
    if (out.size >= 4) break;
  }
  return [...out].sort((a, b) => a - b);
}

/** Флаг для экрана оплаченного заказа: показать «Оплачено», сдачу, всплеск и «дзынь». */
export const JUST_PAID_KEY = "justPaid";

export function PayModal({ order, due, soundEnabled, onClose }: { order: OrderView; due: number; soundEnabled: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [pending, act] = useAction();
  const [split, setSplit] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ method: "CASH", amount: toInput(due), received: "", provider: TRANSFER_PROVIDERS[0] }]);

  const parsed = lines.map((l) => ({
    ...l,
    amountD: split ? (parseMoney(l.amount) ?? 0) : due,
    receivedD: l.received ? parseMoney(l.received) : null,
  }));
  const sum = parsed.reduce((s, l) => s + l.amountD, 0);
  const remaining = due - sum;
  const change = parsed.reduce((s, l) => s + (l.method === "CASH" && l.receivedD && l.receivedD > l.amountD ? l.receivedD - l.amountD : 0), 0);
  const cashShort = parsed.some((l) => l.method === "CASH" && l.receivedD !== null && l.receivedD < l.amountD);
  const ok = remaining === 0 && !cashShort && parsed.every((l) => l.amountD > 0);

  const update = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  const toggleSplit = () => {
    if (split) {
      setSplit(false);
      setLines([{ ...lines[0], amount: toInput(due) }]);
    } else {
      setSplit(true);
      // по сценарию из PRD: часть наличными, остаток картой
      const half = Math.round(due / 2 / 100) * 100;
      setLines([
        { ...lines[0], method: "CASH", amount: toInput(half), received: "" },
        { method: "CARD", amount: toInput(due - half), received: "", provider: TRANSFER_PROVIDERS[0] },
      ]);
    }
  };

  const submit = () => {
    const payload = parsed.map((l) => ({
      method: l.method,
      amount: l.amountD,
      received: l.method === "CASH" && l.receivedD ? l.receivedD : null,
      provider: l.method === "TRANSFER" ? l.provider : null,
    }));
    act(async () => {
      sessionStorage.setItem(JUST_PAID_KEY, JSON.stringify({ id: order.id, change, sound: soundEnabled }));
      const res = await payOrder(order.id, payload);
      if (!res.ok) sessionStorage.removeItem(JUST_PAID_KEY);
      return res;
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t.pay.title}
      width={600}
      footer={
        <>
          <Button variant="ghost" className="mr-auto" onClick={toggleSplit}>
            <Split size={18} strokeWidth={1.75} />
            {split ? t.pay.single : t.pay.split}
          </Button>
          <Button variant="primary" size="lg" disabled={!ok || pending} onClick={submit} className="min-w-[200px]">
            {t.pay.confirm.replace("{sum}", formatMoney(due))}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <div className="flex items-baseline justify-between">
          <span className="text-muted">{t.orders.due}</span>
          <span className="num font-display text-4xl font-semibold text-saffron">{formatMoney(due)}</span>
        </div>

        {parsed.map((l, i) => (
          <div key={i} className={`flex flex-col gap-3 ${split ? "rounded-[var(--radius-card)] border border-line bg-surface-2/40 p-4" : ""}`}>
            <div className="grid grid-cols-4 gap-2">
              {METHODS.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => update(i, { method: id })}
                  className={`flex flex-col items-center justify-center gap-1 rounded-[var(--radius-btn)] border text-sm font-medium transition-colors ${split ? "h-14" : "h-20"} ${
                    l.method === id ? "border-saffron bg-saffron/12 text-saffron" : "border-line bg-surface-2 text-muted hover:text-text"
                  }`}
                >
                  <Icon size={split ? 18 : 24} strokeWidth={1.75} />
                  {t.payMethod[id]}
                </button>
              ))}
            </div>

            {split && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted">{t.pay.amount}</label>
                <input
                  value={l.amount}
                  onChange={(e) => update(i, { amount: e.target.value })}
                  inputMode="decimal"
                  className="num h-12 w-36 rounded-[var(--radius-btn)] border border-line bg-surface px-3 font-display text-lg focus:border-saffron focus:outline-none"
                />
                {lines.length > 1 && (
                  <button type="button" onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))} className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-pomegranate/10 hover:text-pomegranate" aria-label={t.common.delete}>
                    <X size={18} />
                  </button>
                )}
              </div>
            )}

            {l.method === "CASH" && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-sm text-muted">{t.pay.received}</span>
                <input
                  value={l.received}
                  onChange={(e) => update(i, { received: e.target.value })}
                  inputMode="decimal"
                  placeholder={toInput(l.amountD)}
                  className="num h-12 w-32 rounded-[var(--radius-btn)] border border-line bg-surface px-3 font-display text-lg placeholder:text-muted/50 focus:border-saffron focus:outline-none"
                />
                {quickCash(l.amountD).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => update(i, { received: toInput(v) })}
                    className="num h-12 rounded-[var(--radius-btn)] border border-line bg-surface-2 px-3 font-medium hover:border-saffron/50"
                  >
                    {formatMoney(v, { currency: false })}
                  </button>
                ))}
              </div>
            )}

            {l.method === "TRANSFER" && (
              <div className="flex flex-wrap gap-2">
                {TRANSFER_PROVIDERS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => update(i, { provider: p })}
                    className={`h-11 rounded-[var(--radius-btn)] border px-3.5 text-sm transition-colors ${
                      l.provider === p ? "border-lapis bg-lapis/12 text-lapis" : "border-line bg-surface-2 hover:border-muted/50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {split && (
          <div className="flex items-center justify-between">
            <Button
              size="sm"
              variant="ghost"
              disabled={lines.length >= 4}
              onClick={() => setLines((ls) => [...ls, { method: "CARD", amount: toInput(Math.max(remaining, 0)), received: "", provider: TRANSFER_PROVIDERS[0] }])}
            >
              <Plus size={16} />
              {t.pay.addPart}
            </Button>
            <span className={`num text-sm font-semibold ${remaining === 0 ? "text-mint" : "text-apricot"}`}>
              {remaining < 0 ? t.pay.overpaid : t.pay.remaining}: {formatMoney(Math.abs(remaining))}
            </span>
          </div>
        )}

        {change > 0 && (
          <div className="flex items-baseline justify-between rounded-[var(--radius-card)] border border-mint/40 bg-mint/10 px-5 py-4">
            <span className="text-[15px]">{t.pay.giveChange}</span>
            <span className="num font-display text-3xl font-semibold text-mint">{formatMoney(change)}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
