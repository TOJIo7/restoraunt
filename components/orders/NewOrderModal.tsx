"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Minus, Plus, ShoppingBag, Truck, UtensilsCrossed } from "lucide-react";
import { useAction, useI18n } from "@/components/Providers";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FieldLabel, Select } from "@/components/ui/Field";
import { createOrder } from "@/app/actions/orders";
import { seatReservation } from "@/app/actions/reservations";
import { fmt } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { hhmm } from "@/lib/format";

export type FreeTable = { id: number; number: number; seats: number };
export type Waiter = { id: number; name: string };
export type HallReservation = { id: number; name: string; at: string; guests: number; wholeHall: boolean; prepayment: number };
type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";

export function NewOrderModal({
  open,
  onClose,
  waiters,
  couriers = [],
  freeTables,
  presetTableId,
  presetType,
  reservation,
}: {
  open: boolean;
  onClose: () => void;
  waiters: Waiter[];
  couriers?: Waiter[];
  freeTables: FreeTable[];
  presetTableId?: number;
  presetType?: OrderType;
  /** бронь на этот стол — можно «посадить по брони» с предоплатой */
  reservation?: HallReservation | null;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, act] = useAction();
  const [type, setType] = useState<OrderType>(presetType ?? (presetTableId || freeTables.length ? "DINE_IN" : "TAKEAWAY"));
  const [tableId, setTableId] = useState<number | null>(presetTableId ?? null);
  const [waiterId, setWaiterId] = useState<number | null>(null);
  const [guests, setGuests] = useState(reservation?.guests ?? 2);
  const [d, setD] = useState({ customerName: "", phone: "", address: "", fee: "10", courierId: "" });

  const types = [
    { id: "DINE_IN" as const, icon: UtensilsCrossed, label: t.orderType.DINE_IN },
    { id: "TAKEAWAY" as const, icon: ShoppingBag, label: t.orderType.TAKEAWAY },
    { id: "DELIVERY" as const, icon: Truck, label: t.orderType.DELIVERY },
  ];

  const deliveryOk = d.customerName.trim() && d.phone.trim() && d.address.trim();
  const canCreate = type === "TAKEAWAY" || (type === "DINE_IN" && tableId !== null) || (type === "DELIVERY" && deliveryOk);
  const goTo = (id?: number) => id && router.push(`/orders/${id}`);

  const submit = () =>
    act(
      () =>
        createOrder({
          type,
          tableId: type === "DINE_IN" ? tableId : null,
          waiterId,
          guests: type === "DINE_IN" ? guests : null,
          delivery: type === "DELIVERY" ? { ...d, courierId: d.courierId ? Number(d.courierId) : null } : null,
        }),
      { onOk: (data) => goTo(data?.id) },
    );

  const seat = () => act(() => seatReservation(reservation!.id, tableId), { onOk: (data) => goTo(data?.orderId) });
  const presetNumber = freeTables.find((x) => x.id === presetTableId)?.number;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={presetTableId ? fmt(t.hall.table, { n: presetNumber ?? "" }) : t.orders.newOrder}
      width={640}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          {reservation ? (
            <>
              <Button onClick={submit} disabled={!canCreate || pending}>
                {t.orders.create}
              </Button>
              <Button variant="primary" size="lg" onClick={seat} disabled={pending || !tableId}>
                {t.reservations.seatByReservation}
              </Button>
            </>
          ) : (
            <Button variant="primary" size="lg" onClick={submit} disabled={!canCreate || pending}>
              {t.orders.create}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-6 pb-2">
        {reservation && (
          <div className="flex items-start gap-3 rounded-[var(--radius-btn)] border border-lapis/35 bg-lapis/10 px-4 py-3 text-sm">
            <CalendarClock size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-lapis" />
            <div>
              <div className="font-semibold">
                {fmt(t.hall.reservedAt, { time: hhmm(reservation.at) })} · {reservation.name}
                {reservation.wholeHall && ` · ${t.reservations.hallBanquet}`}
              </div>
              <div className="num text-muted">
                {fmt(t.hall.guests, { n: reservation.guests })}
                {reservation.prepayment > 0 && ` · ${fmt(t.reservations.prepaid, { sum: formatMoney(reservation.prepayment) })}`}
              </div>
            </div>
          </div>
        )}

        {!presetTableId && (
          <section>
            <h3 className="mb-2 text-sm text-muted">{t.orders.chooseType}</h3>
            <div className="grid grid-cols-3 gap-3">
              {types.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setType(id)}
                  className={`flex h-20 flex-col items-center justify-center gap-1.5 rounded-[var(--radius-card)] border text-[15px] font-medium transition-colors ${
                    type === id ? "border-saffron bg-saffron/10 text-saffron" : "border-line bg-surface-2 hover:border-muted/50"
                  }`}
                >
                  <Icon size={22} strokeWidth={1.75} />
                  {label}
                </button>
              ))}
            </div>
          </section>
        )}

        {type === "DINE_IN" && !presetTableId && (
          <section>
            <h3 className="mb-2 text-sm text-muted">{t.orders.freeTables}</h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
              {freeTables.map((tb) => (
                <button
                  key={tb.id}
                  type="button"
                  onClick={() => setTableId(tb.id)}
                  className={`num flex h-14 flex-col items-center justify-center rounded-[var(--radius-btn)] border font-display text-lg font-semibold transition-colors ${
                    tableId === tb.id ? "border-saffron bg-saffron text-on-saffron" : "border-line bg-surface-2 hover:border-mint/60"
                  }`}
                >
                  {tb.number}
                  <span className={`text-[10px] font-normal ${tableId === tb.id ? "text-on-saffron/80" : "text-muted"}`}>
                    {tb.seats} {t.common.seats}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {type === "DELIVERY" && (
          <section className="grid grid-cols-2 gap-4">
            <Input label={t.delivery.customer} value={d.customerName} onChange={(e) => setD({ ...d, customerName: e.target.value })} maxLength={80} autoFocus />
            <Input label={t.delivery.phone} value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} inputMode="tel" placeholder="+992 " maxLength={30} />
            <div className="col-span-2">
              <Input label={t.delivery.address} value={d.address} onChange={(e) => setD({ ...d, address: e.target.value })} maxLength={200} />
            </div>
            <Input label={t.delivery.fee} value={d.fee} onChange={(e) => setD({ ...d, fee: e.target.value })} inputMode="decimal" className="num" />
            <FieldLabel label={t.delivery.courier}>
              <Select value={d.courierId} onChange={(e) => setD({ ...d, courierId: e.target.value })}>
                <option value="">{t.delivery.noCourier}</option>
                {couriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FieldLabel>
          </section>
        )}

        {type !== "DELIVERY" && (
          <section>
            <h3 className="mb-2 text-sm text-muted">{t.orders.waiter}</h3>
            <div className="flex flex-wrap gap-2">
              {[{ id: null, name: t.orders.noWaiter }, ...waiters].map((w) => (
                <button
                  key={w.id ?? "none"}
                  type="button"
                  onClick={() => setWaiterId(w.id)}
                  className={`h-12 rounded-[var(--radius-btn)] border px-4 text-[15px] transition-colors ${
                    waiterId === w.id ? "border-saffron bg-saffron/12 text-saffron" : "border-line bg-surface-2 hover:border-muted/50"
                  }`}
                >
                  {w.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {type === "DINE_IN" && !reservation && (
          <section className="flex items-center gap-4">
            <h3 className="text-sm text-muted">{t.orders.guests}</h3>
            <Stepper value={guests} onChange={setGuests} min={1} max={60} />
          </section>
        )}
      </div>
    </Modal>
  );
}

export function Stepper({ value, onChange, min = 1, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="inline-flex items-center rounded-[var(--radius-btn)] border border-line bg-surface-2">
      <button type="button" className="flex h-12 w-12 items-center justify-center text-muted hover:text-text disabled:opacity-40" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="−">
        <Minus size={18} />
      </button>
      <span className="num w-10 text-center font-display text-lg font-semibold">{value}</span>
      <button type="button" className="flex h-12 w-12 items-center justify-center text-muted hover:text-text disabled:opacity-40" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="+">
        <Plus size={18} />
      </button>
    </div>
  );
}
