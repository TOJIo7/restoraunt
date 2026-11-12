"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Truck, UtensilsCrossed, CalendarClock } from "lucide-react";
import { useAction, useI18n } from "@/components/Providers";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { createOrder } from "@/app/actions/orders";
import { fmt } from "@/lib/i18n";

export type FreeTable = { id: number; number: number; seats: number };
export type Waiter = { id: number; name: string };

export function NewOrderModal({
  open,
  onClose,
  waiters,
  freeTables,
  presetTableId,
  presetType,
  reservationNote,
}: {
  open: boolean;
  onClose: () => void;
  waiters: Waiter[];
  freeTables: FreeTable[];
  presetTableId?: number;
  presetType?: "DINE_IN" | "TAKEAWAY";
  reservationNote?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, act] = useAction();
  const [type, setType] = useState<"DINE_IN" | "TAKEAWAY">(presetType ?? (presetTableId || freeTables.length ? "DINE_IN" : "TAKEAWAY"));
  const [tableId, setTableId] = useState<number | null>(presetTableId ?? null);
  const [waiterId, setWaiterId] = useState<number | null>(null);
  const [guests, setGuests] = useState(2);

  const types = [
    { id: "DINE_IN" as const, icon: UtensilsCrossed, label: t.orderType.DINE_IN },
    { id: "TAKEAWAY" as const, icon: ShoppingBag, label: t.orderType.TAKEAWAY },
  ];

  const canCreate = type === "TAKEAWAY" || tableId !== null;

  const submit = () =>
    act(() => createOrder({ type, tableId: type === "DINE_IN" ? tableId : null, waiterId, guests: type === "DINE_IN" ? guests : null }), {
      onOk: (data) => {
        if (data) router.push(`/orders/${data.id}`);
      },
    });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={presetTableId ? fmt(t.hall.table, { n: freeTables.find((x) => x.id === presetTableId)?.number ?? "" }) : t.orders.newOrder}
      width={620}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" size="lg" onClick={submit} disabled={!canCreate || pending}>
            {t.orders.create}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6 pb-2">
        {reservationNote && (
          <div className="flex items-center gap-2.5 rounded-[var(--radius-btn)] border border-lapis/35 bg-lapis/10 px-4 py-3 text-sm">
            <CalendarClock size={18} strokeWidth={1.75} className="text-lapis" />
            {reservationNote}
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
              <button
                type="button"
                disabled
                title={fmt(t.common.stage, { n: 4 })}
                className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-[var(--radius-card)] border border-dashed border-line text-[15px] text-muted opacity-60"
              >
                <Truck size={22} strokeWidth={1.75} />
                {t.orderType.DELIVERY}
              </button>
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

        {type === "DINE_IN" && (
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
