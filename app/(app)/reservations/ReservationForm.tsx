"use client";

import { useState } from "react";
import { useAction, useI18n } from "@/components/Providers";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FieldLabel, Select, Textarea } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { Stepper } from "@/components/orders/NewOrderModal";
import { PAYMENT_METHODS } from "@/lib/constants";
import { fmt } from "@/lib/i18n";
import { parseMoney } from "@/lib/money";
import { createReservation, updateReservation } from "@/app/actions/reservations";
import type { ReservationRow, TableOpt } from "./ReservationsClient";

export function ReservationForm({
  row,
  defaultDate,
  tables,
  hasShift,
  onClose,
}: {
  row?: ReservationRow;
  defaultDate: string;
  tables: TableOpt[];
  hasShift: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [pending, act] = useAction();
  const [v, setV] = useState({
    date: row?.date ?? defaultDate,
    time: row?.time ?? "19:00",
    guests: row?.guests ?? 4,
    tableId: row?.tableId ? String(row.tableId) : "",
    wholeHall: row?.wholeHall ?? false,
    name: row?.name ?? "",
    phone: row?.phone ?? "",
    comment: row?.comment ?? "",
    prepayment: "",
    method: "CASH",
  });
  const prepay = v.prepayment ? parseMoney(v.prepayment) : 0;
  const valid = v.name.trim() && v.phone.trim() && v.date && v.time && prepay !== null;
  // предоплата — это деньги в кассу, нужна открытая смена
  const prepayBlocked = !row && !!prepay && !hasShift;

  const submit = () => {
    const base = {
      date: v.date,
      time: v.time,
      guests: v.guests,
      tableId: v.wholeHall || !v.tableId ? null : Number(v.tableId),
      wholeHall: v.wholeHall,
      name: v.name,
      phone: v.phone,
      comment: v.comment,
    };
    if (row) act(() => updateReservation(row.id, base), { success: t.common.saved, onOk: onClose });
    else act(() => createReservation({ ...base, prepayment: v.prepayment, prepaymentMethod: v.method }), { success: t.common.saved, onOk: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={row ? fmt(t.reservations.edit, { n: row.id }) : t.reservations.add}
      width={620}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" disabled={pending || !valid || prepayBlocked} onClick={submit}>
            {row ? t.common.save : t.reservations.create}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 pb-2">
        <Input label={t.reservations.date} type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
        <Input label={t.reservations.time} type="time" value={v.time} step={900} onChange={(e) => setV({ ...v, time: e.target.value })} />
        <Input label={t.reservations.name} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={80} autoFocus />
        <Input label={t.reservations.phone} value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} inputMode="tel" placeholder="+992 " maxLength={30} />
        <div className="flex flex-col gap-1.5 text-sm text-muted">
          {t.reservations.guests}
          <Stepper value={v.guests} onChange={(g) => setV({ ...v, guests: g })} min={1} max={300} />
        </div>
        <div className="flex flex-col justify-end gap-3">
          <Switch checked={v.wholeHall} onChange={(w) => setV({ ...v, wholeHall: w })} label={t.reservations.wholeHall} />
        </div>
        {!v.wholeHall && (
          <div className="col-span-2">
            <FieldLabel label={t.reservations.table}>
              <Select value={v.tableId} onChange={(e) => setV({ ...v, tableId: e.target.value })}>
                <option value="">{t.reservations.anyTable}</option>
                {tables.map((tb) => (
                  <option key={tb.id} value={tb.id}>
                    {fmt(t.hall.table, { n: tb.number })} · {tb.seats} {t.common.seats}
                    {tb.seats < v.guests ? " ⚠" : ""}
                  </option>
                ))}
              </Select>
            </FieldLabel>
          </div>
        )}
        {!row && (
          <>
            <Input label={t.reservations.prepayment} value={v.prepayment} onChange={(e) => setV({ ...v, prepayment: e.target.value })} inputMode="decimal" placeholder="0" className="num" />
            <FieldLabel label={t.reservations.prepaymentMethod}>
              <Select value={v.method} onChange={(e) => setV({ ...v, method: e.target.value })} disabled={!prepay}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t.payMethod[m]}
                  </option>
                ))}
              </Select>
            </FieldLabel>
            {prepayBlocked && <p className="col-span-2 -mt-2 text-sm text-apricot">{t.errors.noShift}</p>}
          </>
        )}
        <div className="col-span-2">
          <FieldLabel label={t.reservations.comment}>
            <Textarea value={v.comment} onChange={(e) => setV({ ...v, comment: e.target.value })} maxLength={300} placeholder={t.reservations.commentPlaceholder} />
          </FieldLabel>
        </div>
      </div>
    </Modal>
  );
}
