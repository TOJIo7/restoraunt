"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Clock, Plus, ShoppingBag, Truck, User, UtensilsCrossed } from "lucide-react";
import { useI18n } from "@/components/Providers";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/Ornament";
import { NewOrderModal, type FreeTable, type Waiter } from "@/components/orders/NewOrderModal";
import { NoShiftBanner } from "@/components/orders/NoShiftBanner";
import { fmt } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";

export type OrderCard = {
  id: number;
  number: number;
  type: string;
  status: string;
  tableNumber: number | null;
  waiterName: string | null;
  items: number;
  total: number;
  at: string;
  openedAt: string;
};

const TYPE_ICON = { DINE_IN: UtensilsCrossed, TAKEAWAY: ShoppingBag, DELIVERY: Truck } as Record<string, typeof Truck>;

export function OrdersClient({
  tab,
  orders,
  counts,
  waiters,
  freeTables,
  hasShift,
}: {
  tab: "open" | "paid" | "cancelled";
  orders: OrderCard[];
  counts: Record<string, number>;
  waiters: Waiter[];
  freeTables: FreeTable[];
  hasShift: boolean;
}) {
  const { t } = useI18n();
  const [newOpen, setNewOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const tabs = [
    { id: "open", label: t.orders.open },
    { id: "paid", label: t.orders.paidToday },
    { id: "cancelled", label: t.orders.cancelled },
  ] as const;

  return (
    <>
      <PageHeader
        title={t.nav.orders}
        actions={
          <Button variant="primary" onClick={() => setNewOpen(true)} disabled={!hasShift}>
            <Plus size={18} strokeWidth={2} />
            {t.orders.newOrder}
          </Button>
        }
      />
      {!hasShift && <NoShiftBanner />}

      <div className="mb-6 flex gap-1.5">
        {tabs.map((x) => (
          <Link
            key={x.id}
            href={`/orders?tab=${x.id}`}
            className={`relative inline-flex h-12 items-center gap-2 rounded-[var(--radius-btn)] px-4 text-[15px] font-medium transition-colors ${
              tab === x.id ? "text-text" : "text-muted hover:bg-surface-2 hover:text-text"
            }`}
          >
            {tab === x.id && <motion.span layoutId="orders-tab" className="absolute inset-0 rounded-[var(--radius-btn)] border border-saffron/35 bg-saffron/10" />}
            <span className="relative">{x.label}</span>
            <span className="num relative rounded-md bg-surface-2 px-1.5 text-xs text-muted">{counts[x.id]}</span>
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <EmptyState title={t.orders.empty} text={tab === "open" ? t.orders.emptyOpen : ""} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {orders.map((o, i) => {
            const Icon = TYPE_ICON[o.type] ?? UtensilsCrossed;
            const minutes = Math.floor((now - new Date(o.openedAt).getTime()) / 60000);
            const title = o.type === "DINE_IN" ? fmt(t.hall.table, { n: o.tableNumber ?? "" }) : t.orderType[o.type as "TAKEAWAY"];
            const statusCls =
              o.status === "BILL" ? "text-saffron" : o.status === "PAID" ? "text-mint" : o.status === "CANCELLED" ? "text-pomegranate" : "text-muted";
            return (
              <motion.div key={o.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
                <Link
                  href={`/orders/${o.id}`}
                  className={`flex h-full flex-col gap-3 rounded-[var(--radius-card)] border bg-surface p-5 transition-colors hover:bg-surface-2 ${
                    o.status === "BILL" ? "border-saffron/50" : "border-line"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Icon size={20} strokeWidth={1.75} className="text-muted" />
                      <span className="font-display text-lg font-semibold">{title}</span>
                    </div>
                    <span className="num text-sm text-muted">№{o.number}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    {o.waiterName && (
                      <span className="inline-flex items-center gap-1.5">
                        <User size={14} strokeWidth={1.75} />
                        {o.waiterName}
                      </span>
                    )}
                    <span className="num inline-flex items-center gap-1.5">
                      <Clock size={14} strokeWidth={1.75} />
                      {tab === "open"
                        ? fmt(t.hall.busyFor, { m: minutes })
                        : new Date(o.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="mt-auto flex items-end justify-between">
                    <span className={`text-sm font-medium ${statusCls}`}>
                      {t.orderStatus[o.status as "OPEN"]} · {fmt(t.orders.items, { n: o.items })}
                    </span>
                    <span className="num font-display text-xl font-semibold">{formatMoney(o.total)}</span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      {newOpen && <NewOrderModal open onClose={() => setNewOpen(false)} waiters={waiters} freeTables={freeTables} />}
    </>
  );
}
