"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { CalendarDays, ChevronLeft, ChevronRight, MessageSquare, Pencil, Phone, Plus, Trash2, Users, Wallet } from "lucide-react";
import { useAction, useI18n } from "@/components/Providers";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/Ornament";
import { NoShiftBanner } from "@/components/orders/NoShiftBanner";
import type { FreeTable } from "@/components/orders/NewOrderModal";
import { fmt } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { cancelReservation, deleteReservation, markNoShow, seatReservation } from "@/app/actions/reservations";
import { ReservationForm } from "./ReservationForm";

export type ReservationRow = {
  id: number;
  startsAt: string;
  date: string;
  time: string;
  guests: number;
  tableId: number | null;
  tableNumber: number | null;
  wholeHall: boolean;
  name: string;
  phone: string;
  prepayment: number;
  prepaymentMethod: string | null;
  status: string;
  comment: string | null;
  orderId: number | null;
};
export type TableOpt = { id: number; number: number; seats: number };

const STATUS_CLS: Record<string, string> = {
  BOOKED: "bg-lapis/14 text-lapis",
  SEATED: "bg-saffron/14 text-saffron",
  DONE: "bg-mint/14 text-mint",
  CANCELLED: "bg-surface-2 text-muted",
  NO_SHOW: "bg-pomegranate/12 text-pomegranate",
};

// вкладки над списком: «Пришли» включает и уже закрытые («Состоялась»)
const FILTER_STATUSES = {
  BOOKED: ["BOOKED"],
  SEATED: ["SEATED", "DONE"],
  CANCELLED: ["CANCELLED"],
  NO_SHOW: ["NO_SHOW"],
} as const satisfies Record<string, readonly string[]>;
type Filter = "all" | keyof typeof FILTER_STATUSES;
const FILTERS: Filter[] = ["all", "BOOKED", "SEATED", "CANCELLED", "NO_SHOW"];

const addDays =(date: string, n: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function ReservationsClient({
  date,
  today,
  rows,
  weekCounts,
  tables,
  freeTables,
  hasShift,
}: {
  date: string;
  today: string;
  rows: ReservationRow[];
  weekCounts: Record<string, number>;
  tables: TableOpt[];
  freeTables: FreeTable[];
  hasShift: boolean;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState<{ open: boolean; row?: ReservationRow }>({ open: false });
  const [cancel, setCancel] = useState<ReservationRow | null>(null);
  const [seat, setSeat] = useState<ReservationRow | null>(null);
  const [remove, setRemove] = useState<ReservationRow | null>(null);
  const [pending, act] = useAction();
  const loc = locale === "tg" ? "tg-TJ" : "ru-RU";

  const [filter, setFilter] = useState<Filter>("all");
  const active = rows.filter((r) => r.status === "BOOKED" || r.status === "SEATED");
  const guests = active.reduce((s, r) => s + r.guests, 0);
  const inFilter = (r: ReservationRow, f: Filter) => f === "all" || (FILTER_STATUSES[f] as readonly string[]).includes(r.status);
  const shown = rows.filter((r) => inFilter(r, filter));
  const days = Array.from({ length: 7 }, (_, i) => addDays(date, i));

  const doSeat = (r: ReservationRow) => {
    // стол известен — сажаем сразу; «весь зал» или без стола — спрашиваем стол
    if (r.tableId) act(() => seatReservation(r.id), { onOk: (d) => d && router.push(`/orders/${d.orderId}`) });
    else setSeat(r);
  };

  return (
    <>
      <PageHeader
        title={t.nav.reservations}
        subtitle={fmt(t.reservations.summary, { n: active.length, g: guests })}
        actions={
          <Button variant="primary" onClick={() => setForm({ open: true })}>
            <Plus size={18} strokeWidth={2} />
            {t.reservations.add}
          </Button>
        }
      />
      {!hasShift && <NoShiftBanner />}

      {/* Неделя */}
      <div className="mb-6 flex items-center gap-2">
        <Link href={`/reservations?date=${addDays(date, -7)}`} className="flex h-16 w-11 shrink-0 items-center justify-center rounded-[var(--radius-btn)] border border-line text-muted hover:text-text" aria-label="←">
          <ChevronLeft size={20} />
        </Link>
        <div className="grid flex-1 grid-cols-7 gap-2">
          {days.map((d) => {
            const dt = new Date(`${d}T12:00:00`);
            const on = d === date;
            const n = weekCounts[d] ?? 0;
            return (
              <Link
                key={d}
                href={`/reservations?date=${d}`}
                className={`relative flex h-16 flex-col items-center justify-center rounded-[var(--radius-btn)] border transition-colors ${
                  on ? "border-saffron bg-saffron/10" : "border-line bg-surface hover:bg-surface-2"
                }`}
              >
                <span className={`text-xs capitalize ${on ? "text-saffron" : "text-muted"}`}>{d === today ? t.reservations.today : dt.toLocaleDateString(loc, { weekday: "short" })}</span>
                <span className="num font-display text-lg font-semibold">{dt.getDate()}</span>
                {n > 0 && <span className="num absolute right-1.5 top-1.5 rounded-full bg-lapis px-1.5 text-[10px] font-bold text-white">{n}</span>}
              </Link>
            );
          })}
        </div>
        <Link href={`/reservations?date=${addDays(date, 7)}`} className="flex h-16 w-11 shrink-0 items-center justify-center rounded-[var(--radius-btn)] border border-line text-muted hover:text-text" aria-label="→">
          <ChevronRight size={20} />
        </Link>
      </div>

      <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold capitalize">
        <CalendarDays size={20} strokeWidth={1.75} className="text-muted" />
        {new Date(`${date}T12:00:00`).toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" })}
      </h2>

      {rows.length > 0 && (
        <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto" role="tablist">
          {FILTERS.map((f) => {
            const n = rows.filter((r) => inFilter(r, f)).length;
            const on = filter === f;
            return (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setFilter(f)}
                className={`relative inline-flex h-10 shrink-0 items-center gap-2 rounded-[var(--radius-btn)] px-3.5 text-sm font-medium transition-colors ${
                  on ? "text-on-saffron" : "text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                {on && <motion.span layoutId="res-filter" className="absolute inset-0 rounded-[var(--radius-btn)] bg-saffron" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                <span className="relative">{t.reservations.filters[f]}</span>
                <span className={`num relative rounded-full px-1.5 text-xs font-semibold ${on ? "bg-on-saffron/15" : "bg-surface-2"}`}>{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title={t.reservations.empty} text="" />
      ) : shown.length === 0 ? (
        <p className="py-10 text-center text-muted">{t.reservations.emptyFilter}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((r, i) => {
            const open = r.status === "BOOKED";
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 10) * 0.04 }}
                className={`flex flex-wrap items-center gap-5 rounded-[var(--radius-card)] border bg-surface p-5 ${r.wholeHall && open ? "border-lapis/50" : "border-line"} ${open ? "" : "opacity-70"}`}
              >
                <div className="num w-20 font-display text-3xl font-semibold">{r.time}</div>
                <div className="min-w-[220px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-lg font-semibold ${r.status === "CANCELLED" ? "text-muted line-through" : ""}`}>{r.name}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLS[r.status]}`}>{t.reservations.status[r.status as "BOOKED"]}</span>
                    {r.wholeHall && <span className="rounded-full border border-lapis/40 px-2.5 py-0.5 text-xs font-semibold text-lapis">{t.reservations.hallBanquet}</span>}
                  </div>
                  <div className="num mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Users size={14} strokeWidth={1.75} />
                      {fmt(t.hall.guests, { n: r.guests })}
                      {r.tableNumber && ` · ${fmt(t.hall.table, { n: r.tableNumber })}`}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Phone size={14} strokeWidth={1.75} />
                      {r.phone}
                    </span>
                    {r.prepayment > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-mint">
                        <Wallet size={14} strokeWidth={1.75} />
                        {fmt(t.reservations.prepaid, { sum: formatMoney(r.prepayment) })}
                      </span>
                    )}
                  </div>
                  {r.comment && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-sm">
                      <MessageSquare size={14} strokeWidth={1.75} className="text-muted" />
                      {r.comment}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {open && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setForm({ open: true, row: r })} aria-label={t.common.edit}>
                        <Pencil size={16} strokeWidth={1.75} />
                      </Button>
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => markNoShow(r.id), { success: t.reservations.status.NO_SHOW })}>
                        {t.reservations.noShow}
                      </Button>
                      <Button size="sm" variant="ghost" className="hover:!bg-pomegranate/10 hover:!text-pomegranate" onClick={() => setCancel(r)}>
                        {t.common.cancel}
                      </Button>
                      <Button disabled={pending || !hasShift} onClick={() => doSeat(r)}>
                        {t.reservations.seat}
                      </Button>
                    </>
                  )}
                  {(r.status === "CANCELLED" || r.status === "NO_SHOW") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="hover:!bg-pomegranate/10 hover:!text-pomegranate"
                      onClick={() => setRemove(r)}
                      aria-label={t.common.delete}
                    >
                      <Trash2 size={16} strokeWidth={1.75} />
                      {t.common.delete}
                    </Button>
                  )}
                  {r.orderId && (
                    <Link href={`/orders/${r.orderId}`} className="text-sm text-lapis hover:underline">
                      {t.receipt.title} →
                    </Link>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {form.open && <ReservationForm row={form.row} defaultDate={date} tables={tables} hasShift={hasShift} onClose={() => setForm({ open: false })} />}
      {cancel && <CancelReservation row={cancel} onClose={() => setCancel(null)} />}
      {remove && (
        <Modal
          open
          onClose={() => setRemove(null)}
          title={t.reservations.deleteTitle}
          width={460}
          footer={
            <>
              <Button onClick={() => setRemove(null)}>{t.common.close}</Button>
              <Button
                variant="danger"
                disabled={pending}
                onClick={() => act(() => deleteReservation(remove.id), { success: t.reservations.deleted, onOk: () => setRemove(null) })}
              >
                <Trash2 size={16} strokeWidth={1.75} />
                {t.common.delete}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-2 pb-2">
            <div className="text-[15px]">
              {remove.time} · {remove.name} · {fmt(t.hall.guests, { n: remove.guests })}
            </div>
            <p className="text-sm text-muted">{t.reservations.deleteHint}</p>
          </div>
        </Modal>
      )}
      {seat && <SeatModal row={seat} freeTables={freeTables} onClose={() => setSeat(null)} />}
    </>
  );
}

function CancelReservation({ row, onClose }: { row: ReservationRow; onClose: () => void }) {
  const { t } = useI18n();
  const [pending, act] = useAction();
  const [refund, setRefund] = useState(true);
  return (
    <Modal
      open
      onClose={onClose}
      title={t.reservations.cancel}
      width={480}
      footer={
        <>
          <Button onClick={onClose}>{t.common.close}</Button>
          <Button variant="danger" disabled={pending} onClick={() => act(() => cancelReservation(row.id, refund), { success: t.reservations.status.CANCELLED, onOk: onClose })}>
            {t.reservations.cancel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <div className="text-[15px]">
          {row.time} · {row.name} · {fmt(t.hall.guests, { n: row.guests })}
        </div>
        {row.prepayment > 0 && (
          <label className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-btn)] border border-line bg-surface-2/50 p-4">
            <input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} className="h-5 w-5 accent-[var(--saffron)]" />
            <span>{fmt(t.reservations.refund, { sum: formatMoney(row.prepayment) })}</span>
          </label>
        )}
      </div>
    </Modal>
  );
}

function SeatModal({ row, freeTables, onClose }: { row: ReservationRow; freeTables: FreeTable[]; onClose: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, act] = useAction();
  return (
    <Modal open onClose={onClose} title={t.reservations.chooseTableFor} width={540}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2 pb-4">
        {freeTables.map((tb) => (
          <button
            key={tb.id}
            type="button"
            disabled={pending}
            onClick={() => act(() => seatReservation(row.id, tb.id), { onOk: (d) => d && router.push(`/orders/${d.orderId}`) })}
            className={`num flex h-16 flex-col items-center justify-center rounded-[var(--radius-btn)] border font-display text-xl font-semibold transition-colors hover:border-mint/60 hover:bg-mint/10 ${
              tb.seats >= row.guests ? "border-line bg-surface-2" : "border-line/60 bg-surface-2/40 text-muted"
            }`}
          >
            {tb.number}
            <span className="text-[10px] font-normal text-muted">
              {tb.seats} {t.common.seats}
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
