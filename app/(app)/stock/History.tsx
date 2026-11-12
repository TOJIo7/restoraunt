"use client";

import Link from "next/link";
import { useI18n } from "@/components/Providers";
import { EmptyState } from "@/components/Ornament";
import { fmt, pickName } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { ddmm, formatQty, hhmm } from "@/lib/format";
import type { Movement } from "./types";

const TYPE_CLS: Record<string, string> = {
  RECEIPT: "bg-mint/12 text-mint",
  SALE: "bg-lapis/12 text-lapis",
  WRITE_OFF: "bg-pomegranate/12 text-pomegranate",
  INVENTORY: "bg-saffron/12 text-saffron",
  RETURN: "bg-surface-2 text-muted",
};

export function History({ movements }: { movements: Movement[] }) {
  const { t, locale } = useI18n();
  if (movements.length === 0) return <EmptyState title={t.stock.noMovements} text="" />;
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
      <table className="w-full text-sm">
        <thead className="bg-surface text-left text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">{t.stock.when}</th>
            <th className="px-4 py-3 font-medium">{t.stock.type}</th>
            <th className="px-4 py-3 font-medium">{t.stock.product}</th>
            <th className="px-4 py-3 text-right font-medium">{t.stock.qty}</th>
            <th className="px-4 py-3 text-right font-medium">{t.stock.sum}</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody className="num">
          {movements.map((m) => (
            <tr key={m.id} className="border-t border-line">
              <td className="whitespace-nowrap px-4 py-2.5 text-muted">
                {ddmm(m.at)} {hhmm(m.at)}
              </td>
              <td className="px-4 py-2.5">
                <span className={`rounded-full px-2.5 py-1 font-sans text-xs font-semibold ${TYPE_CLS[m.type] ?? ""}`}>{t.stock.movementType[m.type as "SALE"]}</span>
              </td>
              <td className="px-4 py-2.5 font-sans">{pickName(m, locale)}</td>
              <td className={`whitespace-nowrap px-4 py-2.5 text-right font-semibold ${m.qty < 0 ? "" : "text-mint"}`}>
                {m.qty > 0 ? "+" : ""}
                {formatQty(m.qty)} {t.units[m.unit as "KG"]}
              </td>
              <td className="px-4 py-2.5 text-right">{formatMoney(m.value, { currency: false })}</td>
              <td className="px-4 py-2.5 font-sans text-muted">
                {m.orderId ? (
                  <Link href={`/orders/${m.orderId}`} className="text-lapis hover:underline">
                    {fmt(t.stock.order, { n: m.orderNumber ?? "" })}
                  </Link>
                ) : (
                  m.reason
                )}
                {m.by && <span className="text-muted/70"> · {m.by}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
