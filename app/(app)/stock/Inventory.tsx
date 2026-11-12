"use client";

import { useState } from "react";
import { useAction, useI18n, useToast } from "@/components/Providers";
import { Button } from "@/components/ui/Button";
import { fmt, pickName } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { formatQty, parseQty } from "@/lib/format";
import { applyInventory } from "@/app/actions/stock";
import type { Ingredient } from "./types";

export function Inventory({ ingredients }: { ingredients: Ingredient[] }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [pending, act] = useAction();
  const [actual, setActual] = useState<Record<number, string>>({});

  const rows = ingredients.map((i) => {
    const raw = actual[i.id] ?? "";
    const a = raw === "" ? null : parseQty(raw);
    const diff = a === null ? null : Math.round((a - i.stock) * 1000) / 1000;
    return { ...i, raw, a, diff, value: diff ? Math.round(diff * i.lastPrice) : 0, bad: raw !== "" && a === null };
  });
  const changed = rows.filter((r) => r.diff !== null && r.diff !== 0);
  const totalValue = changed.reduce((s, r) => s + r.value, 0);
  const anyBad = rows.some((r) => r.bad);

  return (
    <>
      <p className="mb-4 text-sm text-muted">{t.stock.inventoryHint}</p>
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
        <table className="w-full text-[15px]">
          <thead className="bg-surface text-left text-sm text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t.stock.product}</th>
              <th className="px-4 py-3 text-right font-medium">{t.stock.system}</th>
              <th className="px-4 py-3 font-medium">{t.stock.actual}</th>
              <th className="px-4 py-3 text-right font-medium">{t.stock.diff}</th>
              <th className="px-4 py-3 text-right font-medium">{t.stock.sum}</th>
            </tr>
          </thead>
          <tbody className="num">
            {rows.map((r) => {
              const unit = t.units[r.unit as "KG"];
              const cls = r.diff === null || r.diff === 0 ? "text-muted" : r.diff < 0 ? "text-pomegranate" : "text-mint";
              return (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-4 py-2.5 font-sans font-medium">{pickName(r, locale)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {formatQty(r.stock)} {unit}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="relative w-36">
                      <input
                        value={r.raw}
                        onChange={(e) => setActual((s) => ({ ...s, [r.id]: e.target.value }))}
                        inputMode="decimal"
                        placeholder={formatQty(r.stock).replace(/ /g, "")}
                        aria-label={`${pickName(r, locale)} — ${t.stock.actual}`}
                        className={`h-10 w-full rounded-[var(--radius-btn)] border bg-surface-2 pl-3 pr-9 placeholder:text-muted/35 focus:outline-none ${
                          r.bad ? "border-pomegranate" : "border-line focus:border-saffron"
                        }`}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{unit}</span>
                    </div>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${cls}`}>
                    {r.diff === null ? "" : `${r.diff > 0 ? "+" : ""}${formatQty(r.diff)} ${unit}`}
                  </td>
                  <td className={`px-4 py-2.5 text-right ${cls}`}>{r.value ? `${r.value > 0 ? "+" : ""}${formatMoney(r.value, { currency: false })}` : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="sticky bottom-0 mt-4 flex items-center justify-end gap-5 rounded-[var(--radius-card)] border border-line bg-surface/95 px-5 py-4 backdrop-blur-sm">
        <span className="num">
          <span className="text-muted">{t.stock.diff} </span>
          <span className={`font-display text-xl font-semibold ${totalValue < 0 ? "text-pomegranate" : totalValue > 0 ? "text-mint" : ""}`}>
            {totalValue > 0 ? "+" : ""}
            {formatMoney(totalValue)}
          </span>
        </span>
        <Button
          variant="primary"
          size="lg"
          disabled={pending || changed.length === 0 || anyBad}
          onClick={() =>
            act(() => applyInventory(changed.map((r) => ({ ingredientId: r.id, actual: r.a! }))), {
              onOk: (d) => {
                toast("ok", fmt(t.stock.inventoryDone, { n: d?.changed ?? 0, sum: formatMoney(d?.value ?? 0) }));
                setActual({});
              },
            })
          }
        >
          {t.stock.applyInventory}
        </Button>
      </div>
    </>
  );
}
