"use client";

import { Clock, Users, CalendarClock, Phone } from "lucide-react";
import { useI18n } from "@/components/Providers";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TableStatusBadge } from "@/components/ui/TableStatusBadge";
import { fmt } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import type { HallTable } from "@/lib/hall";

/** Карточка стола по клику на схеме. Открытие заказа появится на этапе 2. */
export function TableDetails({ table, now, onClose }: { table: HallTable | null; now: number; onClose: () => void }) {
  const { t } = useI18n();
  const minutes = table?.since ? Math.floor((now - new Date(table.since).getTime()) / 60000) : null;

  return (
    <Modal
      open={!!table}
      onClose={onClose}
      title={table ? fmt(t.hall.table, { n: table.number }) : ""}
      width={440}
      footer={
        <Button variant="primary" size="lg" className="w-full" disabled title={t.hall.newOrderSoon}>
          {t.hall.newOrder}
        </Button>
      }
    >
      {table && (
        <div className="flex flex-col gap-4 pb-2">
          <div className="flex items-center gap-3">
            <TableStatusBadge status={table.status} />
            <span className="inline-flex items-center gap-1.5 text-sm text-muted">
              <Users size={16} strokeWidth={1.75} />
              <span className="num">{table.seats}</span> {t.common.seats}
            </span>
          </div>

          {minutes !== null && (
            <Row icon={<Clock size={18} strokeWidth={1.75} />} label={fmt(t.hall.busyFor, { m: minutes })} />
          )}
          {table.orderTotal !== null && (
            <div className="num font-display text-3xl font-semibold text-saffron">{formatMoney(table.orderTotal)}</div>
          )}
          {table.reservation && (
            <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-lapis/30 bg-lapis/8 p-4">
              <Row
                icon={<CalendarClock size={18} strokeWidth={1.75} className="text-lapis" />}
                label={fmt(t.hall.reservedAt, {
                  time: new Date(table.reservation.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
                })}
              />
              <Row icon={<Phone size={18} strokeWidth={1.75} />} label={`${table.reservation.name} · ${fmt(t.hall.guests, { n: table.reservation.guests })}`} />
            </div>
          )}
          {table.status === "FREE" && <p className="text-sm text-muted">{t.hall.noOrder}</p>}
          <p className="text-xs text-muted/80">{t.hall.newOrderSoon}</p>
        </div>
      )}
    </Modal>
  );
}

function Row({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-[15px]">
      <span className="text-muted">{icon}</span>
      <span className="num">{label}</span>
    </div>
  );
}
