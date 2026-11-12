"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction, useI18n } from "@/components/Providers";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Stepper, type FreeTable } from "@/components/orders/NewOrderModal";
import { fmt, pickName } from "@/lib/i18n";
import { formatMoney, parseMoney } from "@/lib/money";
import { CANCEL_REASONS, computeTotals, DISCOUNT_REASONS, REMOVE_REASONS } from "@/lib/orders";
import { cancelOrder, moveOrder, removeItem, setDiscount, setItemComment } from "@/app/actions/orders";
import type { OrderView } from "@/lib/order-view";

type Item = OrderView["items"][number];

/** Кнопки-причины + своё поле для «Другое». Возвращает итоговый текст причины. */
function ReasonPicker({ reasons, value, onChange }: { reasons: readonly string[]; value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  const labels = t.reasons as Record<string, string>;
  const preset = reasons.filter((r) => r !== "other");
  const isCustom = value !== "" && !preset.map((r) => labels[r]).includes(value);
  const [custom, setCustom] = useState(isCustom);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {reasons.map((r) => {
          const active = r === "other" ? custom : !custom && value === labels[r];
          return (
            <button
              key={r}
              type="button"
              onClick={() => {
                if (r === "other") {
                  setCustom(true);
                  onChange("");
                } else {
                  setCustom(false);
                  onChange(labels[r]);
                }
              }}
              className={`h-11 rounded-[var(--radius-btn)] border px-3.5 text-sm transition-colors ${
                active ? "border-saffron bg-saffron/12 text-saffron" : "border-line bg-surface-2 hover:border-muted/50"
              }`}
            >
              {labels[r]}
            </button>
          );
        })}
      </div>
      {custom && <Input autoFocus value={value} onChange={(e) => onChange(e.target.value)} maxLength={200} placeholder={labels.other} />}
    </div>
  );
}

export function RemoveItemModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [pending, act] = useAction();
  const [qty, setQty] = useState(item.qty);
  const [reason, setReason] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title={t.orders.removeItem}
      width={520}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="danger" disabled={pending || !reason.trim()} onClick={() => act(() => removeItem(item.id, qty, reason), { onOk: onClose })}>
            {t.orders.removeItem}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <div className="text-lg font-semibold">{pickName(item, locale)}</div>
        {item.qty > 1 && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted">{t.orders.removeQty}</span>
            <Stepper value={qty} onChange={setQty} min={1} max={item.qty} />
          </div>
        )}
        <div>
          <div className="mb-2 text-sm text-muted">{t.orders.removeReason}</div>
          <ReasonPicker reasons={REMOVE_REASONS} value={reason} onChange={setReason} />
        </div>
      </div>
    </Modal>
  );
}

const QUICK_COMMENTS = { ru: ["Без лука", "Острее", "Без соли", "Поменьше масла", "Сначала это"], tg: ["Бе пиёз", "Тезтар", "Бе намак", "Равғани камтар", "Аввал ин"] };

export function CommentModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [pending, act] = useAction();
  const [text, setText] = useState(item.comment ?? "");
  return (
    <Modal
      open
      onClose={onClose}
      title={pickName(item, locale)}
      width={520}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" disabled={pending} onClick={() => act(() => setItemComment(item.id, text), { onOk: onClose })}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-2">
        <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={120} placeholder={t.orders.commentPlaceholder} label={t.orders.comment} />
        <div className="flex flex-wrap gap-2">
          {QUICK_COMMENTS[locale].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setText((v) => (v ? `${v}, ${c.toLowerCase()}` : c))}
              className="h-10 rounded-[var(--radius-btn)] border border-line bg-surface-2 px-3 text-sm hover:border-lapis/50"
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export function DiscountModal({ order, isOwner, onClose }: { order: OrderView; isOwner: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [pending, act] = useAction();
  const [type, setType] = useState<"PERCENT" | "AMOUNT">((order.discountType as "PERCENT" | "AMOUNT") ?? "PERCENT");
  const [value, setValue] = useState(
    order.discountType === "PERCENT" ? String(order.discountValue / 100) : order.discountType === "AMOUNT" ? String(order.discountValue / 100) : "",
  );
  const [reason, setReason] = useState(order.discountReason ?? "");
  const [pin, setPin] = useState("");

  // проценты и деньги вводятся одинаково: "10" или "12,5"
  const parsed = parseMoney(value); // ×100: 10% → 1000 б.п., 10 TJS → 1000 дирам
  const valid = parsed !== null && parsed > 0 && (type === "AMOUNT" || parsed <= 10000);
  const preview = valid ? computeTotals({ ...order, discountType: type, discountValue: parsed! }) : null;
  const needPin = !isOwner;

  return (
    <Modal
      open
      onClose={onClose}
      title={t.orders.discountTitle}
      width={540}
      footer={
        <>
          {order.discountType && (
            <Button
              variant="ghost"
              className="mr-auto"
              disabled={pending || (needPin && pin.length !== 4)}
              onClick={() => act(() => setDiscount(order.id, { type: null, value: 0, ownerPin: pin }), { onOk: onClose })}
            >
              {t.orders.removeDiscount}
            </Button>
          )}
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button
            variant="primary"
            disabled={pending || !valid || !reason.trim() || (needPin && pin.length !== 4)}
            onClick={() => act(() => setDiscount(order.id, { type, value: parsed!, reason, ownerPin: pin }), { success: t.common.saved, onOk: onClose })}
          >
            {t.orders.apply}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <div className="flex items-end gap-3">
          <div className="inline-flex rounded-[var(--radius-btn)] border border-line bg-surface-2 p-1">
            {(["PERCENT", "AMOUNT"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setType(k)}
                className={`h-10 rounded-lg px-4 text-sm font-medium transition-colors ${type === k ? "bg-saffron text-on-saffron" : "text-muted"}`}
              >
                {k === "PERCENT" ? `${t.orders.discountPercent}, %` : `${t.orders.discountAmount}, TJS`}
              </button>
            ))}
          </div>
          <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder={type === "PERCENT" ? "10" : "20"} className="num w-28 font-display text-lg" autoFocus aria-label={t.orders.discountValue} />
          {preview && (
            <div className="num ml-auto text-right text-sm text-muted">
              −{formatMoney(preview.discountAmount)}
              <div className="font-display text-lg font-semibold text-text">{formatMoney(preview.total)}</div>
            </div>
          )}
        </div>
        <div>
          <div className="mb-2 text-sm text-muted">{t.orders.discountReason}</div>
          <ReasonPicker reasons={DISCOUNT_REASONS} value={reason} onChange={setReason} />
        </div>
        {needPin && (
          <div className="rounded-[var(--radius-btn)] border border-saffron/30 bg-saffron/8 p-4">
            <div className="mb-2 text-sm">{t.orders.ownerPinHint}</div>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="••••"
              aria-label={t.orders.ownerPin}
              className="num h-12 w-32 rounded-[var(--radius-btn)] border border-line bg-surface px-3 text-center text-lg tracking-[0.4em] focus:border-saffron focus:outline-none"
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

export function MoveModal({ orderId, freeTables, onClose }: { orderId: number; freeTables: FreeTable[]; onClose: () => void }) {
  const { t } = useI18n();
  const [pending, act] = useAction();
  return (
    <Modal open onClose={onClose} title={t.orders.moveTo} width={520}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2 pb-4">
        {freeTables.map((tb) => (
          <button
            key={tb.id}
            type="button"
            disabled={pending}
            onClick={() => act(() => moveOrder(orderId, tb.id), { success: fmt(t.hall.table, { n: tb.number }), onOk: onClose })}
            className="num flex h-16 flex-col items-center justify-center rounded-[var(--radius-btn)] border border-line bg-surface-2 font-display text-xl font-semibold transition-colors hover:border-mint/60 hover:bg-mint/10"
          >
            {tb.number}
            <span className="text-[10px] font-normal text-muted">
              {tb.seats} {t.common.seats}
            </span>
          </button>
        ))}
        {freeTables.length === 0 && <p className="col-span-full py-6 text-center text-muted">{t.orders.empty}</p>}
      </div>
    </Modal>
  );
}

export function CancelModal({ orderId, onClose, paid }: { orderId: number; onClose: () => void; paid?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, act] = useAction();
  const [reason, setReason] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title={t.orders.cancelOrder}
      width={520}
      footer={
        <>
          <Button onClick={onClose}>{t.common.close}</Button>
          <Button
            variant="danger"
            disabled={pending || !reason.trim()}
            onClick={() =>
              act(() => cancelOrder(orderId, reason), {
                success: t.orderStatus.CANCELLED,
                onOk: () => {
                  onClose();
                  if (!paid) router.push("/hall");
                },
              })
            }
          >
            {t.orders.cancelOrder}
          </Button>
        </>
      }
    >
      <div className="pb-2">
        <div className="mb-2 text-sm text-muted">{t.orders.cancelReason}</div>
        <ReasonPicker reasons={CANCEL_REASONS} value={reason} onChange={setReason} />
      </div>
    </Modal>
  );
}
