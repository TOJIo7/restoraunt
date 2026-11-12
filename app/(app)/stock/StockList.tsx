"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Plus, Trash2, TriangleAlert } from "lucide-react";
import { useAction, useI18n } from "@/components/Providers";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { FieldLabel, Select } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { pickName } from "@/lib/i18n";
import { formatMoney, parseMoney } from "@/lib/money";
import { formatQty, parseQty } from "@/lib/format";
import { UNITS } from "@/lib/constants";
import { archiveIngredient, saveIngredient } from "@/app/actions/stock";
import { stockLevel, type Ingredient } from "./types";

export function StockList({ ingredients, isOwner }: { ingredients: Ingredient[]; isOwner: boolean }) {
  const { t, locale } = useI18n();
  const [onlyLow, setOnlyLow] = useState(false);
  const [form, setForm] = useState<{ open: boolean; ing?: Ingredient }>({ open: false });

  // сначала то, что в минусе и заканчивается
  const order = { negative: 0, low: 1, ok: 2 } as const;
  const list = ingredients
    .filter((i) => !onlyLow || stockLevel(i) !== "ok")
    .sort((a, b) => order[stockLevel(a)] - order[stockLevel(b)] || pickName(a, locale).localeCompare(pickName(b, locale)));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Switch checked={onlyLow} onChange={setOnlyLow} label={t.stock.onlyLow} />
        {isOwner && (
          <Button onClick={() => setForm({ open: true })}>
            <Plus size={18} strokeWidth={1.75} />
            {t.stock.addProduct}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
        <table className="w-full text-[15px]">
          <thead className="bg-surface text-left text-sm text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t.stock.product}</th>
              <th className="px-4 py-3 font-medium">{t.stock.stockLeft}</th>
              <th className="px-4 py-3 text-right font-medium">{t.stock.minStock}</th>
              <th className="px-4 py-3 text-right font-medium">{t.stock.lastPrice}</th>
              <th className="px-4 py-3 text-right font-medium">{t.stock.value}</th>
            </tr>
          </thead>
          <tbody className="num">
            {list.map((i, idx) => {
              const level = stockLevel(i);
              const unit = t.units[i.unit as "KG"];
              const pct = Math.max(0, Math.min(100, (i.stock / Math.max(i.minStock * 3, 0.001)) * 100));
              return (
                <motion.tr
                  key={i.id}
                  // «мало на складе» — строка мягко подсвечивается абрикосовым один раз, без мигания
                  initial={level !== "ok" ? { backgroundColor: "color-mix(in srgb, var(--apricot) 28%, transparent)" } : false}
                  animate={{ backgroundColor: level === "negative" ? "color-mix(in srgb, var(--pomegranate) 9%, transparent)" : level === "low" ? "color-mix(in srgb, var(--apricot) 7%, transparent)" : "rgba(0,0,0,0)" }}
                  transition={{ duration: 1.2, delay: idx * 0.03 }}
                  onClick={isOwner ? () => setForm({ open: true, ing: i }) : undefined}
                  className={`border-t border-line ${isOwner ? "cursor-pointer hover:!bg-surface-2" : ""}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-sans font-medium">
                      {level !== "ok" && <TriangleAlert size={16} strokeWidth={1.9} className={level === "negative" ? "text-pomegranate" : "text-apricot"} aria-label={level === "negative" ? t.stock.negative : t.stock.low} />}
                      {pickName(i, locale)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`w-24 font-semibold ${level === "negative" ? "text-pomegranate" : level === "low" ? "text-apricot" : ""}`}>
                        {formatQty(i.stock)} {unit}
                      </span>
                      <span className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-surface-2 md:block">
                        <span className={`block h-full rounded-full ${level === "ok" ? "bg-mint" : level === "low" ? "bg-apricot" : "bg-pomegranate"}`} style={{ width: `${pct}%` }} />
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-muted">
                    {formatQty(i.minStock)} {unit}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatMoney(i.lastPrice, { currency: false })}
                    <span className="text-muted"> / {unit}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatMoney(Math.round(Math.max(i.stock, 0) * i.lastPrice), { currency: false })}</td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {form.open && <IngredientForm ing={form.ing} onClose={() => setForm({ open: false })} />}
    </>
  );
}

const toInput = (d: number) => (d % 100 ? (d / 100).toFixed(2).replace(".", ",") : String(d / 100));

function IngredientForm({ ing, onClose }: { ing?: Ingredient; onClose: () => void }) {
  const { t } = useI18n();
  const [pending, act] = useAction();
  const [confirm, setConfirm] = useState(false);
  const [v, setV] = useState({
    nameRu: ing?.nameRu ?? "",
    nameTg: ing?.nameTg ?? "",
    unit: ing?.unit ?? "KG",
    minStock: ing ? formatQty(ing.minStock).replace(/ /g, "") : "",
    lastPrice: ing ? toInput(ing.lastPrice) : "",
    initialStock: "",
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  const min = parseQty(v.minStock || "0");
  const price = parseMoney(v.lastPrice || "0");
  const initial = v.initialStock ? parseQty(v.initialStock) : 0;
  const valid = v.nameRu.trim() && v.nameTg.trim() && min !== null && price !== null && initial !== null;

  return (
    <Modal
      open
      onClose={onClose}
      title={ing ? ing.nameRu : t.stock.addProduct}
      width={540}
      footer={
        <>
          {ing && (
            <Button variant={confirm ? "danger" : "ghost"} className="mr-auto" disabled={pending} onClick={() => (confirm ? act(() => archiveIngredient(ing.id), { success: t.common.saved, onOk: onClose }) : setConfirm(true))}>
              <Trash2 size={18} strokeWidth={1.75} />
              {confirm ? t.common.areYouSure : t.stock.archive}
            </Button>
          )}
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button
            variant="primary"
            disabled={pending || !valid}
            onClick={() =>
              act(() => saveIngredient({ id: ing?.id, nameRu: v.nameRu, nameTg: v.nameTg, unit: v.unit, minStock: min!, lastPrice: price!, initialStock: initial ?? 0 }), {
                success: t.common.saved,
                onOk: onClose,
              })
            }
          >
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 pb-2">
        <Input label={t.stock.nameRu} value={v.nameRu} onChange={set("nameRu")} maxLength={60} autoFocus />
        <Input label={t.stock.nameTg} value={v.nameTg} onChange={set("nameTg")} maxLength={60} />
        <FieldLabel label={t.stock.unit}>
          <Select value={v.unit} onChange={set("unit")}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {t.units[u]}
              </option>
            ))}
          </Select>
        </FieldLabel>
        <Input label={`${t.stock.minStock}, ${t.units[v.unit as "KG"]}`} value={v.minStock} onChange={set("minStock")} inputMode="decimal" className="num" />
        <Input label={t.stock.pricePerUnit.replace("{u}", t.units[v.unit as "KG"])} value={v.lastPrice} onChange={set("lastPrice")} inputMode="decimal" className="num" />
        {!ing && <Input label={`${t.stock.initialStock}, ${t.units[v.unit as "KG"]}`} value={v.initialStock} onChange={set("initialStock")} inputMode="decimal" className="num" />}
      </div>
    </Modal>
  );
}
