"use client";

import { useState } from "react";
import { Check, MapPin, Pencil, Phone, User } from "lucide-react";
import { useAction, useI18n } from "@/components/Providers";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FieldLabel, Select } from "@/components/ui/Field";
import { DELIVERY_STATUSES } from "@/lib/constants";
import { setDeliveryStatus, updateDelivery } from "@/app/actions/orders";
import type { Waiter } from "./NewOrderModal";

export type DeliveryInfo = {
  customerName: string;
  phone: string;
  address: string;
  fee: number;
  courierId: number | null;
  courierName: string | null;
  status: string;
};

const toInput = (d: number) => (d % 100 ? (d / 100).toFixed(2).replace(".", ",") : String(d / 100));

/** Доставка: кому, куда, курьер и статус «готовится → в пути → доставлен». */
export function DeliveryPanel({ orderId, delivery, couriers, canEditFee }: { orderId: number; delivery: DeliveryInfo; couriers: Waiter[]; canEditFee: boolean }) {
  const { t } = useI18n();
  const [pending, act] = useAction();
  const [edit, setEdit] = useState(false);
  const idx = DELIVERY_STATUSES.indexOf(delivery.status as (typeof DELIVERY_STATUSES)[number]);
  const next = DELIVERY_STATUSES[idx + 1];

  const save = (patch: Partial<{ customerName: string; phone: string; address: string; fee: string; courierId: number | null }>) =>
    act(
      () =>
        updateDelivery(orderId, {
          customerName: delivery.customerName,
          phone: delivery.phone,
          address: delivery.address,
          fee: toInput(delivery.fee),
          courierId: delivery.courierId,
          ...patch,
        }),
      { success: t.common.saved },
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1 text-sm">
          <span className="flex items-center gap-2 font-semibold">
            <User size={15} strokeWidth={1.75} className="text-muted" />
            {delivery.customerName}
          </span>
          <a href={`tel:${delivery.phone.replace(/[^\d+]/g, "")}`} className="num flex items-center gap-2 text-muted hover:text-text">
            <Phone size={15} strokeWidth={1.75} />
            {delivery.phone}
          </a>
          <span className="flex items-start gap-2 text-muted">
            <MapPin size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" />
            {delivery.address}
          </span>
        </div>
        <button type="button" onClick={() => setEdit(true)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text" aria-label={t.delivery.edit}>
          <Pencil size={16} strokeWidth={1.75} />
        </button>
      </div>

      <Select
        value={delivery.courierId ?? ""}
        onChange={(e) => save({ courierId: e.target.value ? Number(e.target.value) : null })}
        aria-label={t.delivery.courier}
        className="h-11"
        disabled={pending}
      >
        <option value="">{t.delivery.noCourier}</option>
        {couriers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>

      {/* шаги статуса */}
      <div className="flex items-center gap-1.5">
        {DELIVERY_STATUSES.map((st, i) => (
          <div key={st} className="flex flex-1 items-center gap-1.5">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                i < idx ? "bg-mint text-white" : i === idx ? "bg-saffron text-on-saffron" : "bg-surface-2 text-muted"
              }`}
            >
              {i < idx ? <Check size={14} strokeWidth={2.5} /> : i + 1}
            </span>
            <span className={`truncate text-xs ${i === idx ? "font-semibold" : "text-muted"}`}>{t.delivery.status[st]}</span>
          </div>
        ))}
      </div>
      {next && (
        <Button size="sm" disabled={pending} onClick={() => act(() => setDeliveryStatus(orderId, next), { success: t.delivery.status[next] })}>
          {t.delivery.next[delivery.status as "COOKING"]}
        </Button>
      )}

      {edit && <DeliveryEdit delivery={delivery} canEditFee={canEditFee} onClose={() => setEdit(false)} onSave={(v) => save(v)} pending={pending} />}
    </div>
  );
}

function DeliveryEdit({
  delivery,
  canEditFee,
  onClose,
  onSave,
  pending,
}: {
  delivery: DeliveryInfo;
  canEditFee: boolean;
  onClose: () => void;
  onSave: (v: { customerName: string; phone: string; address: string; fee: string }) => void;
  pending: boolean;
}) {
  const { t } = useI18n();
  const [v, setV] = useState({ customerName: delivery.customerName, phone: delivery.phone, address: delivery.address, fee: toInput(delivery.fee) });
  return (
    <Modal
      open
      onClose={onClose}
      title={t.delivery.edit}
      width={520}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button
            variant="primary"
            disabled={pending}
            onClick={() => {
              onSave(v);
              onClose();
            }}
          >
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 pb-2">
        <Input label={t.delivery.customer} value={v.customerName} onChange={(e) => setV({ ...v, customerName: e.target.value })} maxLength={80} />
        <Input label={t.delivery.phone} value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} inputMode="tel" maxLength={30} />
        <div className="col-span-2">
          <Input label={t.delivery.address} value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} maxLength={200} />
        </div>
        <FieldLabel label={t.delivery.fee}>
          <input
            value={v.fee}
            onChange={(e) => setV({ ...v, fee: e.target.value })}
            disabled={!canEditFee}
            inputMode="decimal"
            className="num h-12 w-full rounded-[var(--radius-btn)] border border-line bg-surface-2 px-4 text-text focus:border-saffron focus:outline-none disabled:opacity-50"
          />
        </FieldLabel>
      </div>
    </Modal>
  );
}
