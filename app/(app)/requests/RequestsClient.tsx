"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Bike, CalendarClock, Check, MapPin, MessageSquare, Phone, ShoppingBag, X } from "lucide-react";
import { useAction, useI18n } from "@/components/Providers";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/Ornament";
import { NoShiftBanner } from "@/components/orders/NoShiftBanner";
import { fmt, pickName } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { SITE } from "@/lib/site";
import { acceptRequest, rejectRequest } from "@/app/actions/requests";

const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
  ssr: false,
  loading: () => <div className="skeleton h-44 rounded-[var(--radius-card)]" />,
});

type Tab = "NEW" | "ACCEPTED" | "REJECTED";

export type RequestRow = {
  id: number;
  kind: "ORDER" | "BOOKING";
  status: string;
  name: string;
  phone: string;
  comment: string | null;
  orderType: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  payMethod: string | null;
  total: number | null;
  startsAt: string | null;
  guests: number | null;
  orderId: number | null;
  reservationId: number | null;
  rejectReason: string | null;
  createdAt: string;
  items: { dishId: number; qty: number; nameRu: string; nameTg: string; price: number }[];
};

export function RequestsClient({
  tab,
  rows,
  counts,
  tables,
  hasShift,
}: {
  tab: Tab;
  rows: RequestRow[];
  counts: Record<string, number>;
  tables: { id: number; number: number; seats: number }[];
  hasShift: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [rejecting, setRejecting] = useState<RequestRow | null>(null);

  // новые заявки приходят сами — обновляем страницу раз в 20 секунд
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(id);
  }, [router]);

  // «5 мин назад» — тикает
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const needsShift = tab === "NEW" && !hasShift && rows.some((r) => r.kind === "ORDER");

  return (
    <>
      <PageHeader title={t.requests.title} subtitle={tab === "NEW" ? t.requests.hint : undefined} />

      <nav className="mb-6 flex gap-1.5">
        {(["NEW", "ACCEPTED", "REJECTED"] as const).map((id) => (
          <Link
            key={id}
            href={`/requests?tab=${id}`}
            className={`relative inline-flex h-12 items-center gap-2 rounded-[var(--radius-btn)] px-4 text-[15px] font-medium transition-colors ${tab === id ? "text-text" : "text-muted hover:bg-surface-2 hover:text-text"}`}
          >
            {tab === id && <motion.span layoutId="requests-tab" className="absolute inset-0 rounded-[var(--radius-btn)] border border-saffron/35 bg-saffron/10" />}
            <span className="relative">{t.requests.tabs[id]}</span>
            {!!counts[id] && (
              <span className={`num relative rounded-full px-2 py-0.5 text-xs font-semibold ${id === "NEW" ? "bg-pomegranate text-on-pomegranate" : "bg-surface-2 text-muted"}`}>
                {counts[id]}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {needsShift && <NoShiftBanner />}

      {rows.length === 0 ? (
        <EmptyState title={t.requests.empty} text={t.requests.emptyText} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {rows.map((r) => (
            <RequestCard key={r.id} r={r} now={now} tables={tables} hasShift={hasShift} onReject={() => setRejecting(r)} />
          ))}
        </div>
      )}

      {rejecting && <RejectModal r={rejecting} onClose={() => setRejecting(null)} />}
    </>
  );
}

function RequestCard({
  r,
  now,
  tables,
  hasShift,
  onReject,
}: {
  r: RequestRow;
  now: number;
  tables: { id: number; number: number; seats: number }[];
  hasShift: boolean;
  onReject: () => void;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, act] = useAction();
  const [tableId, setTableId] = useState("");
  const minutes = Math.max(0, Math.floor((now - new Date(r.createdAt).getTime()) / 60000));
  const isOrder = r.kind === "ORDER";
  const Icon = isOrder ? (r.orderType === "DELIVERY" ? Bike : ShoppingBag) : CalendarClock;
  const when = r.startsAt
    ? new Date(r.startsAt).toLocaleString(locale === "tg" ? "tg-TJ" : "ru-RU", { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : null;

  const accept = () =>
    act(() => acceptRequest(r.id, { tableId: tableId ? Number(tableId) : null }), {
      success: t.requests.accepted,
      onOk: (d) => {
        if (d?.orderId) router.push(`/orders/${d.orderId}`);
      },
    });

  return (
    <Card className={`flex flex-col gap-4 p-5 ${r.status === "NEW" ? "border-saffron/35" : ""}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isOrder ? "bg-saffron/12 text-saffron" : "bg-lapis/12 text-lapis"}`}>
          <Icon size={22} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <h2 className="font-display text-lg font-semibold">
              {isOrder ? `${t.requests.order} · ${t.orderType[(r.orderType ?? "TAKEAWAY") as "TAKEAWAY"]}` : t.requests.booking}
            </h2>
            <span className="num text-sm text-muted">№{r.id}</span>
          </div>
          <div className="text-sm text-muted">
            {r.name} · <span className="num">{r.phone}</span> · {fmt(t.requests.ago, { m: minutes })}
          </div>
        </div>
        <a
          href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[var(--radius-btn)] border border-line px-3 text-sm font-medium transition-colors hover:border-mint/50 hover:text-mint"
        >
          <Phone size={16} strokeWidth={1.75} />
          {t.requests.call}
        </a>
      </div>

      {isOrder ? (
        <>
          <ul className="flex flex-col gap-1.5 text-sm">
            {r.items.map((i) => (
              <li key={i.dishId} className="flex items-baseline gap-2">
                <span className="num w-8 shrink-0 text-muted">{i.qty}×</span>
                <span className="flex-1">{pickName(i, locale)}</span>
                <span className="num">{formatMoney(i.price * i.qty, { currency: false })}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-sm text-muted">{r.payMethod ? t.requests.pay[r.payMethod as "CASH"] : ""}</span>
            <span className="num font-display text-xl font-semibold">{formatMoney(r.total ?? 0)}</span>
          </div>
          {r.orderType === "DELIVERY" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-2 text-sm">
                <MapPin size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-saffron" />
                <span>{r.address}</span>
              </div>
              {r.lat != null && r.lng != null && (
                <LeafletMap center={{ lat: r.lat, lng: r.lng }} marker={{ lat: r.lat, lng: r.lng }} home={{ lat: SITE.lat, lng: SITE.lng }} zoom={15} className="h-44" />
              )}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="font-display text-xl font-semibold first-letter:uppercase">{when}</span>
          <span className="text-muted">{fmt(t.requests.guests, { n: r.guests ?? 1 })}</span>
        </div>
      )}

      {r.comment && (
        <div className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
          <MessageSquare size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-muted" />
          {r.comment}
        </div>
      )}

      {r.status === "NEW" && (
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
          {!isOrder && (
            <Select value={tableId} onChange={(e) => setTableId(e.target.value)} className="!h-12 w-auto min-w-40" aria-label={t.requests.table}>
              <option value="">{t.requests.noTable}</option>
              {tables.map((tb) => (
                <option key={tb.id} value={tb.id}>
                  {fmt(t.hall.table, { n: tb.number })} · {tb.seats}
                </option>
              ))}
            </Select>
          )}
          <Button variant="ghost" onClick={onReject} disabled={pending}>
            <X size={18} strokeWidth={1.75} />
            {t.requests.reject}
          </Button>
          <Button variant="primary" className="ml-auto" onClick={accept} disabled={pending || (isOrder && !hasShift)}>
            <Check size={18} strokeWidth={2} />
            {t.requests.accept}
          </Button>
        </div>
      )}
      {r.status === "ACCEPTED" && (
        <div className="mt-auto">
          {r.orderId ? (
            <Link href={`/orders/${r.orderId}`} className="text-sm font-medium text-saffron hover:underline">
              {t.requests.openOrder} →
            </Link>
          ) : (
            <Link href="/reservations" className="text-sm font-medium text-saffron hover:underline">
              {t.requests.openReservations} →
            </Link>
          )}
        </div>
      )}
      {r.status === "REJECTED" && r.rejectReason && (
        <p className="mt-auto text-sm text-muted">
          {t.requests.reason}: {r.rejectReason}
        </p>
      )}
    </Card>
  );
}

function RejectModal({ r, onClose }: { r: RequestRow; onClose: () => void }) {
  const { t } = useI18n();
  const [pending, act] = useAction();
  const [reason, setReason] = useState<string>(t.requests.reasons.a);
  return (
    <Modal
      open
      onClose={onClose}
      title={`${t.requests.rejectTitle} №${r.id}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button variant="danger" disabled={pending || !reason.trim()} onClick={() => act(() => rejectRequest(r.id, reason), { success: t.requests.rejected, onOk: onClose })}>
            {t.requests.reject}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap gap-2">
        {(["a", "b", "c", "d"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setReason(t.requests.reasons[k])}
            className={`h-10 rounded-full border px-4 text-sm transition-colors ${reason === t.requests.reasons[k] ? "border-saffron/50 bg-saffron/12 text-saffron" : "border-line text-muted hover:text-text"}`}
          >
            {t.requests.reasons[k]}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <Input label={t.requests.rejectReason} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
      </div>
    </Modal>
  );
}
