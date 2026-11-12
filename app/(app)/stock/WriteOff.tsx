"use client";

import { useState } from "react";
import { PackageX } from "lucide-react";
import { useAction, useI18n } from "@/components/Providers";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { FieldLabel, Select } from "@/components/ui/Field";
import { pickName } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { ddmm, formatQty, hhmm, parseQty } from "@/lib/format";
import { writeOff } from "@/app/actions/stock";
import type { Ingredient, Movement } from "./types";

const REASONS = ["spoiled", "defect", "expired", "staffMeal", "other"] as const;

export function WriteOff({ ingredients, movements }: { ingredients: Ingredient[]; movements: Movement[] }) {
  const { t, locale } = useI18n();
  const [pending, act] = useAction();
  const [id, setId] = useState<number | "">("");
  const [qty, setQty] = useState("");
  const [reasonKey, setReasonKey] = useState<(typeof REASONS)[number]>("spoiled");
  const [custom, setCustom] = useState("");
  const ing = id ? ingredients.find((i) => i.id === id) : undefined;
  const q = parseQty(qty);
  const reason = reasonKey === "other" ? custom.trim() : t.stock.writeOffReasons[reasonKey];
  const tooMuch = !!ing && q !== null && q > ing.stock;
  const loss = ing && q ? Math.round(q * ing.lastPrice) : 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <Card className="p-6">
        <h2 className="mb-5 flex items-center gap-2.5 font-display text-lg font-semibold">
          <PackageX size={20} strokeWidth={1.75} className="text-pomegranate" />
          {t.stock.writeOffTitle}
        </h2>
        <div className="flex flex-col gap-4">
          <FieldLabel label={t.stock.product}>
            <Select value={id} onChange={(e) => setId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">—</option>
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {pickName(i, locale)} · {formatQty(i.stock)} {t.units[i.unit as "KG"]}
                </option>
              ))}
            </Select>
          </FieldLabel>
          <Input
            label={`${t.stock.qty}${ing ? `, ${t.units[ing.unit as "KG"]}` : ""}`}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputMode="decimal"
            className="num w-40"
          />
          {tooMuch && <p className="-mt-2 text-sm text-pomegranate">{t.errors.writeOffTooMuch}</p>}
          <div>
            <div className="mb-2 text-sm text-muted">{t.stock.reason}</div>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReasonKey(r)}
                  className={`h-11 rounded-[var(--radius-btn)] border px-3.5 text-sm transition-colors ${
                    reasonKey === r ? "border-saffron bg-saffron/12 text-saffron" : "border-line bg-surface-2 hover:border-muted/50"
                  }`}
                >
                  {t.stock.writeOffReasons[r]}
                </button>
              ))}
            </div>
            {reasonKey === "other" && <Input className="mt-3" value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={200} autoFocus />}
          </div>
          <div className="flex items-center justify-between border-t border-line pt-4">
            <span className="num">
              <span className="text-muted">{t.stock.loss} </span>
              <span className="font-display text-xl font-semibold text-pomegranate">{formatMoney(loss)}</span>
            </span>
            <Button
              variant="danger"
              disabled={pending || !ing || !q || q <= 0 || tooMuch || !reason}
              onClick={() =>
                act(() => writeOff({ ingredientId: ing!.id, qty: q!, reason }), {
                  success: t.common.saved,
                  onOk: () => {
                    setQty("");
                    setCustom("");
                  },
                })
              }
            >
              {t.stock.doWriteOff}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-3 text-sm text-muted">{t.stock.recentWriteOffs}</h3>
        {movements.length === 0 ? (
          <p className="text-sm text-muted/80">{t.stock.noWriteOffs}</p>
        ) : (
          <ul className="num flex flex-col">
            {movements.map((m) => (
              <li key={m.id} className="flex items-center gap-3 border-t border-line py-3 text-sm first:border-t-0">
                <span className="w-20 text-muted">
                  {ddmm(m.at)} {hhmm(m.at)}
                </span>
                <span className="min-w-0 flex-1 truncate font-sans">
                  {pickName(m, locale)} · {formatQty(Math.abs(m.qty))} {t.units[m.unit as "KG"]}
                  {m.reason && <span className="text-muted"> · {m.reason}</span>}
                </span>
                <span className="font-semibold text-pomegranate">−{formatMoney(m.value, { currency: false })}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
