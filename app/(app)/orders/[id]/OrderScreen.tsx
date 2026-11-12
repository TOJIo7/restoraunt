"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRightLeft, MessageSquare, Minus, Percent, Plus, Receipt, Trash2, XCircle } from "lucide-react";
import { useAction, useI18n } from "@/components/Providers";
import { Button } from "@/components/ui/Button";
import { AnimatedMoney } from "@/components/ui/AnimatedMoney";
import { Select } from "@/components/ui/Field";
import { Stepper, type FreeTable, type Waiter } from "@/components/orders/NewOrderModal";
import { NoShiftBanner } from "@/components/orders/NoShiftBanner";
import { DeliveryPanel } from "@/components/orders/DeliveryPanel";
import { fmt, pickName } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { computeTotals, FREE_REMOVE_MINUTES } from "@/lib/orders";
import { addItem, removeItem, requestBill, updateOrderInfo } from "@/app/actions/orders";
import type { OrderView, PickerMenu } from "@/lib/order-view";
import { MenuPicker } from "./MenuPicker";
import { CancelModal, CommentModal, DiscountModal, MoveModal, RemoveItemModal } from "./dialogs";
import { PayModal } from "./PayModal";

type Item = OrderView["items"][number];

/** Блюдо добавлено недавно — можно убрать без причины. Вызывается только из обработчиков кликов. */
function isFresh(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() < FREE_REMOVE_MINUTES * 60_000;
}

type Fly = { id: number; label: string; from: DOMRect; to: DOMRect };

export function OrderScreen({
  order,
  menu,
  waiters,
  couriers,
  freeTables,
  hasShift,
  isOwner,
  settings,
}: {
  order: OrderView;
  menu: PickerMenu;
  waiters: Waiter[];
  couriers: Waiter[];
  freeTables: FreeTable[];
  hasShift: boolean;
  isOwner: boolean;
  settings: { restaurantName: string; soundEnabled: boolean };
}) {
  const { t, locale } = useI18n();
  const [, act] = useAction();
  const ticketRef = useRef<HTMLDivElement>(null);
  const [flies, setFlies] = useState<Fly[]>([]);
  const flyId = useRef(0);
  const [dialog, setDialog] = useState<
    | { kind: "remove"; item: Item }
    | { kind: "comment"; item: Item }
    | { kind: "discount" }
    | { kind: "move" }
    | { kind: "cancel" }
    | { kind: "pay" }
    | null
  >(null);

  const items = order.items.filter((i) => !i.removed);
  const totals = computeTotals(order);
  const count = items.reduce((s, i) => s + i.qty, 0);
  const title = order.type === "DINE_IN" ? fmt(t.hall.table, { n: order.tableNumber ?? "" }) : t.orderType[order.type as "TAKEAWAY"];
  const isDelivery = order.type === "DELIVERY" && !!order.delivery;

  /** Блюдо «летит» из плитки в чек, а заказ обновляется на сервере параллельно. */
  const pick = (dish: { id: number; nameRu: string; nameTg: string }, el: HTMLElement) => {
    const to = ticketRef.current?.getBoundingClientRect();
    if (to) {
      const id = ++flyId.current;
      setFlies((f) => [...f, { id, label: pickName(dish, locale), from: el.getBoundingClientRect(), to }]);
      setTimeout(() => setFlies((f) => f.filter((x) => x.id !== id)), 450);
    }
    act(() => addItem(order.id, dish.id));
  };

  const minus = (item: Item) => {
    // только что добавленное убираем сразу; давнее — с причиной
    if (isFresh(item.createdAt)) act(() => removeItem(item.id, 1));
    else setDialog({ kind: "remove", item });
  };

  return (
    <div className="-my-4 flex h-[calc(100vh-110px)] min-h-[560px] gap-6">
      {/* Меню */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-4 flex items-center gap-3">
          <Link href="/hall" className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-btn)] border border-line text-muted hover:text-text" aria-label={t.orders.backToHall}>
            <ArrowLeft size={20} strokeWidth={1.75} />
          </Link>
          <h1 className="font-display text-2xl font-semibold">{title}</h1>
          <span className="num text-muted">· {fmt(t.orders.order, { n: order.number })}</span>
        </div>
        {!hasShift && <NoShiftBanner />}
        <MenuPicker menu={menu} onPick={pick} disabled={!hasShift} />
      </div>

      {/* Чек */}
      <aside className="flex w-[400px] shrink-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {isDelivery && (
          <div className="border-b border-line p-4">
            <DeliveryPanel orderId={order.id} delivery={order.delivery!} couriers={couriers} canEditFee />
          </div>
        )}
        <div className={`flex flex-wrap items-center gap-2 border-b border-line p-4 ${isDelivery ? "hidden" : ""}`}>
          <div className="min-w-[150px] flex-1">
            <Select
              value={order.waiterId ?? ""}
              onChange={(e) => act(() => updateOrderInfo(order.id, { waiterId: e.target.value ? Number(e.target.value) : null }))}
              aria-label={t.orders.waiter}
              className="h-11"
            >
              <option value="">{t.orders.noWaiter}</option>
              {waiters.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </div>
          {order.type === "DINE_IN" && <Stepper value={order.guests ?? 1} onChange={(v) => act(() => updateOrderInfo(order.id, { guests: v }))} min={1} max={60} />}
          {order.status === "BILL" && (
            <span className="w-full rounded-lg bg-saffron/12 px-3 py-1.5 text-center text-sm font-semibold text-saffron">{t.orderStatus.BILL}</span>
          )}
        </div>

        <div ref={ticketRef} className="flex-1 overflow-y-auto px-2 py-2">
          {items.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-muted">{t.orders.addDishes}</p>
          ) : (
            <ul>
              <AnimatePresence initial={false}>
                {items.map((i) => (
                  <motion.li
                    key={i.id}
                    layout
                    initial={{ opacity: 0, backgroundColor: "color-mix(in srgb, var(--saffron) 18%, transparent)" }}
                    animate={{ opacity: 1, backgroundColor: "rgba(0,0,0,0)" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="group rounded-xl px-2 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-medium">{pickName(i, locale)}</div>
                        <div className="num text-xs text-muted">
                          {formatMoney(i.price, { currency: false })} × {i.qty}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <IconBtn label="−" onClick={() => minus(i)}>
                          <Minus size={16} />
                        </IconBtn>
                        <span className="num w-7 text-center font-semibold">{i.qty}</span>
                        <IconBtn label="+" onClick={() => act(() => addItem(order.id, i.dishId))} disabled={!!i.comment}>
                          <Plus size={16} />
                        </IconBtn>
                      </div>
                      <div className="num w-[72px] text-right font-semibold">{formatMoney(i.qty * i.price, { currency: false })}</div>
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setDialog({ kind: "comment", item: i })}
                        className={`inline-flex min-h-7 items-center gap-1.5 rounded-lg px-2 text-xs transition-colors ${
                          i.comment ? "bg-lapis/12 text-lapis" : "text-muted/70 hover:bg-surface-2 hover:text-text"
                        }`}
                      >
                        <MessageSquare size={13} strokeWidth={1.75} />
                        {i.comment ?? t.orders.comment}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDialog({ kind: "remove", item: i })}
                        className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted/60 opacity-0 transition-opacity hover:bg-pomegranate/10 hover:text-pomegranate group-hover:opacity-100"
                        aria-label={t.orders.removeItem}
                      >
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        {/* Итоги */}
        <div className="border-t border-line p-4">
          <dl className="mb-3 flex flex-col gap-1 text-sm">
            <Line label={`${t.orders.subtotal} · ${fmt(t.orders.items, { n: count })}`} value={totals.subtotal} />
            {totals.discountAmount > 0 && (
              <Line
                label={`${t.orders.discount}${order.discountType === "PERCENT" ? ` ${order.discountValue / 100}%` : ""}`}
                value={-totals.discountAmount}
                className="text-mint"
              />
            )}
            {totals.serviceAmount > 0 && <Line label={fmt(t.orders.service, { p: order.serviceChargeBp / 100 })} value={totals.serviceAmount} />}
            {totals.deliveryFee > 0 && <Line label={t.orders.delivery} value={totals.deliveryFee} />}
            {totals.prepaymentApplied > 0 && <Line label={t.orders.prepayment} value={-totals.prepaymentApplied} className="text-lapis" />}
          </dl>
          <div className="mb-4 flex items-baseline justify-between">
            <span className="text-muted">{t.orders.total}</span>
            <AnimatedMoney value={totals.total} className="font-display text-3xl font-semibold" />
          </div>

          <div className="mb-2 grid grid-cols-4 gap-2">
            <SmallAction icon={<Percent size={18} strokeWidth={1.75} />} label={t.orders.discount} onClick={() => setDialog({ kind: "discount" })} disabled={!items.length} />
            <SmallAction
              icon={<ArrowRightLeft size={18} strokeWidth={1.75} />}
              label={t.orders.move}
              onClick={() => setDialog({ kind: "move" })}
              disabled={order.type !== "DINE_IN"}
            />
            <SmallAction
              icon={<Receipt size={18} strokeWidth={1.75} />}
              label={t.orders.bill}
              onClick={() => act(() => requestBill(order.id), { success: t.orderStatus.BILL })}
              disabled={!items.length || order.status === "BILL"}
            />
            <SmallAction icon={<XCircle size={18} strokeWidth={1.75} />} label={t.common.cancel} onClick={() => setDialog({ kind: "cancel" })} danger />
          </div>
          <Button variant="primary" size="lg" className="w-full text-lg" disabled={!items.length || !hasShift} onClick={() => setDialog({ kind: "pay" })}>
            {t.orders.pay} <span className="num">{formatMoney(totals.due)}</span>
          </Button>
        </div>
      </aside>

      {/* Летящие блюда */}
      {flies.map((f) => (
        <motion.div
          key={f.id}
          className="pointer-events-none fixed z-[70] rounded-[var(--radius-btn)] border border-saffron bg-surface-2 px-3 py-2 text-sm font-medium shadow-[0_0_24px_var(--glow)]"
          initial={{ left: f.from.left, top: f.from.top, width: f.from.width, opacity: 1, scale: 1 }}
          animate={{ left: f.to.left + 16, top: f.to.top + 8, width: f.to.width - 32, opacity: 0.2, scale: 0.9 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          {f.label}
        </motion.div>
      ))}

      {dialog?.kind === "remove" && <RemoveItemModal item={dialog.item} onClose={() => setDialog(null)} />}
      {dialog?.kind === "comment" && <CommentModal item={dialog.item} onClose={() => setDialog(null)} />}
      {dialog?.kind === "discount" && <DiscountModal order={order} isOwner={isOwner} onClose={() => setDialog(null)} />}
      {dialog?.kind === "move" && <MoveModal orderId={order.id} freeTables={freeTables} onClose={() => setDialog(null)} />}
      {dialog?.kind === "cancel" && <CancelModal orderId={order.id} onClose={() => setDialog(null)} />}
      {dialog?.kind === "pay" && (
        <PayModal order={order} due={totals.due} soundEnabled={settings.soundEnabled} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function Line({ label, value, className = "" }: { label: string; value: number; className?: string }) {
  return (
    <div className={`flex justify-between ${className}`}>
      <dt className="text-muted">{label}</dt>
      <dd className="num">{formatMoney(value, { currency: false })}</dd>
    </div>
  );
}

function IconBtn({ children, label, onClick, disabled }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted transition-[background-color,transform] hover:bg-surface-2 hover:text-text active:scale-[0.94] disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function SmallAction({ icon, label, onClick, disabled, danger }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-btn)] border border-line text-[11px] font-medium text-muted transition-[background-color,color,transform] active:scale-[0.97] disabled:opacity-35 ${
        danger ? "hover:border-pomegranate/40 hover:bg-pomegranate/10 hover:text-pomegranate" : "hover:bg-surface-2 hover:text-text"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
