"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, FileDown, XCircle } from "lucide-react";
import { useI18n } from "@/components/Providers";
import { Button } from "@/components/ui/Button";
import { Receipt } from "@/components/orders/Receipt";
import { DeliveryPanel } from "@/components/orders/DeliveryPanel";
import { Card } from "@/components/ui/Card";
import type { Waiter } from "@/components/orders/NewOrderModal";
import { fmt } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { burst, playChime } from "@/lib/fx";
import type { OrderView } from "@/lib/order-view";
import { CancelModal } from "./dialogs";
import { JUST_PAID_KEY } from "./PayModal";

export function PaidOrderView({ order, restaurantName, isOwner, couriers }: { order: OrderView; restaurantName: string; isOwner: boolean; couriers: Waiter[] }) {
  const { t } = useI18n();
  // Только что оплатили? Флаг кладёт окно оплаты. Экран монтируется в браузере сразу после оплаты,
  // поэтому читаем его при первом рендере — чтобы галочка успела анимироваться.
  const [justPaid] = useState<{ change: number; sound: boolean } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const flag = JSON.parse(sessionStorage.getItem(JUST_PAID_KEY) ?? "null");
      return flag && flag.id === order.id && order.status === "PAID" ? { change: flag.change, sound: flag.sound } : null;
    } catch {
      return null;
    }
  });
  const [cancel, setCancel] = useState(false);
  const checkRef = useRef<HTMLDivElement>(null);

  // «дзынь» и всплеск частиц — один раз
  useEffect(() => {
    if (!justPaid) return;
    sessionStorage.removeItem(JUST_PAID_KEY);
    if (justPaid.sound) playChime();
    requestAnimationFrame(() => {
      const r = checkRef.current?.getBoundingClientRect();
      if (r) burst(r.left + r.width / 2, r.top + r.height / 2);
    });
  }, [justPaid]);

  const cancelled = order.status === "CANCELLED";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_auto_1fr]">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Link href="/hall" className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-btn)] border border-line text-muted hover:text-text" aria-label={t.orders.backToHall}>
            <ArrowLeft size={20} strokeWidth={1.75} />
          </Link>
          <h1 className="font-display text-2xl font-semibold">{fmt(t.orders.order, { n: order.number })}</h1>
        </div>

        {cancelled ? (
          <div className="rounded-[var(--radius-card)] border border-pomegranate/40 bg-pomegranate/10 p-5 text-[15px]">
            {fmt(t.orders.readOnlyCancelled, { r: order.cancelReason ?? "" })}
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <motion.div
              ref={checkRef}
              initial={justPaid ? { scale: 0.4, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 18 }}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-mint text-white"
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={justPaid ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 0.35, delay: 0.15 }} />
              </svg>
            </motion.div>
            <div>
              <div className="font-display text-2xl font-semibold text-mint">{t.pay.success}</div>
              {order.paidAt && (
                <div className="num text-sm text-muted">
                  {fmt(t.orders.paidAt, { t: new Date(order.paidAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) })}
                </div>
              )}
            </div>
          </div>
        )}

        {justPaid && justPaid.change > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-[var(--radius-card)] border border-mint/40 bg-mint/10 p-5"
          >
            <div className="text-sm text-muted">{t.pay.giveChange}</div>
            <div className="num font-display text-4xl font-semibold text-mint">{formatMoney(justPaid.change)}</div>
          </motion.div>
        )}

        {!cancelled && order.delivery && order.delivery.status !== "DELIVERED" && (
          <Card className="p-4">
            <DeliveryPanel orderId={order.id} delivery={order.delivery} couriers={couriers} canEditFee={false} />
          </Card>
        )}

        {!cancelled && <p className="text-sm text-muted">{t.orders.readOnlyPaid}</p>}

        <div className="flex flex-wrap gap-3">
          <Link
            href="/hall"
            className="inline-flex h-14 items-center rounded-[var(--radius-btn)] bg-saffron px-6 text-base font-semibold text-on-saffron transition-[filter,transform] hover:brightness-110 active:scale-[0.97]"
          >
            {t.pay.done}
          </Link>
          <Button size="lg" onClick={() => window.print()}>
            <FileDown size={18} strokeWidth={1.75} />
            {t.pay.savePdf}
          </Button>
        </div>
        {isOwner && !cancelled && (
          <Button variant="ghost" className="self-start hover:!bg-pomegranate/10 hover:!text-pomegranate" onClick={() => setCancel(true)}>
            <XCircle size={18} strokeWidth={1.75} />
            {t.orders.cancelOrder}
          </Button>
        )}
      </div>

      <motion.div initial={justPaid ? { opacity: 0, y: 24 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}>
        <Receipt order={order} restaurantName={restaurantName} />
      </motion.div>
      <div />

      {cancel && <CancelModal orderId={order.id} paid onClose={() => setCancel(false)} />}
    </div>
  );
}
