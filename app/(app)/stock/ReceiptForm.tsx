"use client";

import { useState } from "react";
import { Plus, Truck, X } from "lucide-react";
import { useAction, useI18n, useToast } from "@/components/Providers";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { FieldLabel, Select } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { fmt, pickName } from "@/lib/i18n";
import { formatMoney, parseMoney } from "@/lib/money";
import { ddmm, parseQty } from "@/lib/format";
import { createReceipt } from "@/app/actions/stock";
import type { Ingredient, ReceiptRow, Supplier } from "./types";

type Row = { key: number; ingredientId: number | ""; qty: string; price: string };
const toInput = (d: number) => (d % 100 ? (d / 100).toFixed(2).replace(".", ",") : String(d / 100));
const today = () => new Date().toISOString().slice(0, 10);

export function ReceiptForm({ ingredients, suppliers, receipts }: { ingredients: Ingredient[]; suppliers: Supplier[]; receipts: ReceiptRow[] }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [pending, act] = useAction();
  const [supplier, setSupplier] = useState<string>(suppliers[0] ? String(suppliers[0].id) : "new");
  const [newSupplier, setNewSupplier] = useState("");
  const [date, setDate] = useState(today);
  const [paidFromCash, setPaidFromCash] = useState(false);
  const [rows, setRows] = useState<Row[]>([{ key: 0, ingredientId: "", qty: "", price: "" }]);
  const byId = new Map(ingredients.map((i) => [i.id, i]));

  const lines = rows.map((r) => {
    const ing = r.ingredientId ? byId.get(r.ingredientId) : undefined;
    const q = parseQty(r.qty);
    const p = parseMoney(r.price);
    return { ...r, ing, q, p, sum: q && p !== null ? Math.round(q * p) : 0 };
  });
  const filled = lines.filter((l) => l.ingredientId !== "");
  const total = filled.reduce((s, l) => s + l.sum, 0);
  const valid = filled.length > 0 && filled.every((l) => l.q && l.q > 0 && l.p !== null) && (supplier !== "new" || newSupplier.trim());

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const submit = () =>
    act(
      () =>
        createReceipt({
          supplierId: supplier !== "new" ? Number(supplier) : null,
          supplierName: supplier === "new" ? newSupplier : null,
          date,
          paidFromCash,
          items: filled.map((l) => ({ ingredientId: Number(l.ingredientId), qty: l.q!, price: l.p! })),
        }),
      {
        onOk: (data) => {
          toast("ok", fmt(t.stock.receiptSaved, { sum: formatMoney(data?.total ?? 0) }));
          if (data?.resumed.length) toast("ok", fmt(t.stock.resumedDishes, { list: data.resumed.join(", ") }));
          setRows([{ key: Date.now(), ingredientId: "", qty: "", price: "" }]);
          setPaidFromCash(false);
        },
      },
    );

  return (
    <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      <Card className="p-6">
        <h2 className="mb-5 flex items-center gap-2.5 font-display text-lg font-semibold">
          <Truck size={20} strokeWidth={1.75} className="text-saffron" />
          {t.stock.receiptTitle}
        </h2>
        <div className="mb-5 grid gap-4 sm:grid-cols-[1fr_1fr_170px]">
          <FieldLabel label={t.stock.supplier}>
            <Select value={supplier} onChange={(e) => setSupplier(e.target.value)}>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="new">+ {t.stock.newSupplier}</option>
            </Select>
          </FieldLabel>
          {supplier === "new" ? <Input label={t.stock.newSupplier} value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} maxLength={80} /> : <div />}
          <Input label={t.stock.date} type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="grid grid-cols-[1fr_120px_130px_100px_40px] gap-2 px-1 pb-1 text-xs text-muted">
          <span>{t.stock.product}</span>
          <span>{t.stock.qty}</span>
          <span>{t.stock.lastPrice}</span>
          <span className="text-right">{t.stock.sum}</span>
          <span />
        </div>
        <div className="flex flex-col gap-2">
          {lines.map((l) => (
            <div key={l.key} className="grid grid-cols-[1fr_120px_130px_100px_40px] items-center gap-2">
              <Select
                value={l.ingredientId}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : "";
                  const ing = id ? byId.get(id) : undefined;
                  // подставляем прошлую цену — обычно она та же
                  update(l.key, { ingredientId: id, price: ing && !l.price ? toInput(ing.lastPrice) : l.price });
                }}
                className="h-11"
              >
                <option value="">—</option>
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {pickName(i, locale)}
                  </option>
                ))}
              </Select>
              <Unit value={l.qty} onChange={(v) => update(l.key, { qty: v })} unit={l.ing ? t.units[l.ing.unit as "KG"] : ""} placeholder="20" />
              <Unit value={l.price} onChange={(v) => update(l.key, { price: v })} unit={l.ing ? `/${t.units[l.ing.unit as "KG"]}` : ""} placeholder="14" />
              <span className="num text-right font-semibold">{l.sum ? formatMoney(l.sum, { currency: false }) : "—"}</span>
              <button type="button" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== l.key) : rs))} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-pomegranate/10 hover:text-pomegranate" aria-label={t.common.delete}>
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => setRows((rs) => [...rs, { key: Math.max(0, ...rs.map((r) => r.key)) + 1, ingredientId: "", qty: "", price: "" }])}>
          <Plus size={16} />
          {t.stock.addRow}
        </Button>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
          <Switch checked={paidFromCash} onChange={setPaidFromCash} label={t.stock.paidFromCash} />
          <div className="flex items-center gap-5">
            <span className="num">
              <span className="text-muted">{t.stock.total} </span>
              <span className="font-display text-2xl font-semibold">{formatMoney(total)}</span>
            </span>
            <Button variant="primary" size="lg" disabled={pending || !valid} onClick={submit}>
              {t.stock.saveReceipt}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-3 text-sm text-muted">{t.stock.recentReceipts}</h3>
        {receipts.length === 0 ? (
          <p className="text-sm text-muted/80">{t.stock.noReceipts}</p>
        ) : (
          <ul className="num flex flex-col">
            {receipts.map((r) => (
              <li key={r.id} className="flex items-center gap-3 border-t border-line py-3 text-sm first:border-t-0">
                <span className="w-12 text-muted">{ddmm(r.date)}</span>
                <span className="min-w-0 flex-1 truncate font-sans">
                  {r.supplier ?? "—"}
                  <span className="text-muted"> · {fmt(t.orders.items, { n: r.items })}</span>
                </span>
                <span className="font-semibold">{formatMoney(r.total, { currency: false })}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Unit({ value, onChange, unit, placeholder }: { value: string; onChange: (v: string) => void; unit: string; placeholder?: string }) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder={placeholder}
        className="num h-11 w-full rounded-[var(--radius-btn)] border border-line bg-surface-2 pl-3 pr-10 placeholder:text-muted/40 focus:border-saffron focus:outline-none"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{unit}</span>
    </div>
  );
}
