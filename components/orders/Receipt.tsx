"use client";

import { useI18n } from "@/components/Providers";
import { fmt, pickName } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { computeTotals } from "@/lib/orders";
import type { OrderView } from "@/lib/order-view";

/**
 * Чек на экране. Всегда «бумажный» (светлый) — и в тёмной теме, и при печати в PDF.
 * Класс print-area: при печати видно только его (см. globals.css).
 */
export function Receipt({ order, restaurantName }: { order: OrderView; restaurantName: string }) {
  const { t, locale } = useI18n();
  const totals = computeTotals(order);
  const items = order.items.filter((i) => !i.removed);
  const change = order.payments.reduce((s, p) => s + (p.received ? p.received - p.amount : 0), 0);
  const when = new Date(order.paidAt ?? order.openedAt);

  return (
    <div className="print-area receipt-paper mx-auto w-full max-w-[360px] bg-[#fffcf7] px-7 pb-10 pt-7 text-[#1e1915] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.5)]">
      <div className="text-center">
        <div className="font-display text-xl font-semibold">{restaurantName}</div>
        <div className="mt-1 text-xs text-[#6b5f51]">{t.receipt.notFiscal}</div>
      </div>

      <div className="my-4 border-t border-dashed border-[#c9bba8]" />

      <div className="num grid grid-cols-2 gap-y-1 text-[13px]">
        <span className="text-[#6b5f51]">{fmt(t.receipt.order, { n: order.number })}</span>
        <span className="text-right">{t.orderType[order.type as "DINE_IN"]}</span>
        <span className="text-[#6b5f51]">{t.receipt.date}</span>
        <span className="text-right">
          {when.toLocaleDateString("ru-RU")} {when.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
        </span>
        {order.tableNumber && (
          <>
            <span className="text-[#6b5f51]">{fmt(t.receipt.table, { n: "" }).trim()}</span>
            <span className="text-right">{order.tableNumber}</span>
          </>
        )}
        {order.delivery && (
          <>
            <span className="text-[#6b5f51]">{t.delivery.customer}</span>
            <span className="text-right">{order.delivery.customerName}</span>
            <span className="col-span-2 text-[#6b5f51]">{order.delivery.address}</span>
          </>
        )}
        {order.waiterName && (
          <>
            <span className="text-[#6b5f51]">{t.receipt.waiter}</span>
            <span className="text-right">{order.waiterName}</span>
          </>
        )}
      </div>

      <div className="my-4 border-t border-dashed border-[#c9bba8]" />

      <ul className="flex flex-col gap-2 text-[14px]">
        {items.map((i) => (
          <li key={i.id}>
            <div className="flex justify-between gap-3">
              <span>{pickName(i, locale)}</span>
              <span className="num shrink-0">{formatMoney(i.qty * i.price, { currency: false })}</span>
            </div>
            <div className="num text-xs text-[#6b5f51]">
              {i.qty} × {formatMoney(i.price, { currency: false })}
              {i.comment ? ` · ${i.comment}` : ""}
            </div>
          </li>
        ))}
      </ul>

      <div className="my-4 border-t border-dashed border-[#c9bba8]" />

      <dl className="num flex flex-col gap-1 text-[13px]">
        <Row label={t.orders.subtotal} value={formatMoney(totals.subtotal, { currency: false })} />
        {totals.discountAmount > 0 && (
          <Row label={`${t.orders.discount}${order.discountReason ? ` (${order.discountReason})` : ""}`} value={`−${formatMoney(totals.discountAmount, { currency: false })}`} />
        )}
        {totals.serviceAmount > 0 && <Row label={fmt(t.orders.service, { p: order.serviceChargeBp / 100 })} value={formatMoney(totals.serviceAmount, { currency: false })} />}
        {totals.deliveryFee > 0 && <Row label={t.orders.delivery} value={formatMoney(totals.deliveryFee, { currency: false })} />}
        {totals.prepaymentApplied > 0 && <Row label={t.orders.prepayment} value={`−${formatMoney(totals.prepaymentApplied, { currency: false })}`} />}
      </dl>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="font-semibold">{t.orders.total}</span>
        <span className="num font-display text-2xl font-semibold">{formatMoney(totals.total)}</span>
      </div>

      {order.payments.length > 0 && (
        <dl className="num mt-3 flex flex-col gap-1 text-[13px]">
          {order.payments.map((p) => (
            <Row
              key={p.id}
              label={`${t.payMethod[p.method as "CASH"]}${p.provider ? ` · ${p.provider}` : ""}${p.received ? ` (${formatMoney(p.received, { currency: false })})` : ""}`}
              value={formatMoney(p.amount, { currency: false })}
            />
          ))}
          {change > 0 && <Row label={t.pay.change} value={formatMoney(change, { currency: false })} />}
        </dl>
      )}

      <div className="my-4 border-t border-dashed border-[#c9bba8]" />
      <div className="text-center text-sm">{t.receipt.thanks}</div>
      {order.cashierName && (
        <div className="mt-1 text-center text-xs text-[#6b5f51]">
          {t.receipt.cashier}: {order.cashierName}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[#6b5f51]">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
