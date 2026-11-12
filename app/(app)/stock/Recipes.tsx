"use client";

import { useMemo, useState } from "react";
import { Ban, Plus, X } from "lucide-react";
import { useAction, useI18n } from "@/components/Providers";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Field";
import { fmt, pickName } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { formatQty, parseQty } from "@/lib/format";
import { saveRecipe } from "@/app/actions/stock";
import type { Ingredient, RecipeDish } from "./types";

export function marginClass(m: number) {
  return m < 30 ? "text-pomegranate" : m < 55 ? "text-apricot" : "text-mint";
}

export function Recipes({ dishes, ingredients }: { dishes: RecipeDish[]; ingredients: Ingredient[] }) {
  const { t, locale } = useI18n();
  const [edit, setEdit] = useState<RecipeDish | null>(null);

  // группы по категориям, порядок — как в меню
  const groups = useMemo(() => {
    const m = new Map<string, { title: string; items: RecipeDish[] }>();
    for (const d of dishes) {
      const key = d.categoryRu;
      if (!m.has(key)) m.set(key, { title: locale === "tg" ? d.categoryTg : d.categoryRu, items: [] });
      m.get(key)!.items.push(d);
    }
    return [...m.values()];
  }, [dishes, locale]);

  return (
    <>
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
        <table className="w-full text-[15px]">
          <thead className="bg-surface text-left text-sm text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t.stock.dish}</th>
              <th className="px-4 py-3 text-right font-medium">{t.stock.price}</th>
              <th className="px-4 py-3 text-right font-medium">{t.stock.cost}</th>
              <th className="px-4 py-3 text-right font-medium">{t.stock.margin}</th>
              <th className="w-56 px-4 py-3 font-medium" />
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.title} className="num">
              <tr className="border-t border-line bg-surface/60">
                <td colSpan={5} className="px-4 py-2 font-sans text-xs font-semibold uppercase tracking-wider text-muted">
                  {g.title}
                </td>
              </tr>
              {g.items.map((d) => (
                <tr key={d.id} onClick={() => setEdit(d)} className="cursor-pointer border-t border-line transition-colors hover:bg-surface-2">
                  <td className="px-4 py-3 font-sans font-medium">
                    <span className="inline-flex items-center gap-2">
                      {pickName(d, locale)}
                      {d.autoStopped && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-pomegranate/12 px-2 py-0.5 text-xs font-semibold text-pomegranate">
                          <Ban size={12} strokeWidth={2} />
                          {t.stock.autoStopped}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{formatMoney(d.price, { currency: false })}</td>
                  <td className="px-4 py-3 text-right">{d.recipe.length ? formatMoney(d.cost, { currency: false }) : <span className="text-apricot">{t.stock.noRecipe}</span>}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${marginClass(d.margin)}`}>{d.recipe.length ? `${d.margin}%` : "—"}</td>
                  <td className="px-4 py-3">
                    {d.recipe.length > 0 && (
                      <div className="flex h-2 overflow-hidden rounded-full bg-surface-2" title={`${t.stock.cost} / ${t.stock.margin}`}>
                        <div className="h-full bg-apricot/70" style={{ width: `${Math.min(100, (d.cost / d.price) * 100)}%` }} />
                        <div className="h-full bg-mint/70" style={{ width: `${Math.max(0, 100 - (d.cost / d.price) * 100)}%` }} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      {edit && <RecipeEditor dish={edit} ingredients={ingredients} onClose={() => setEdit(null)} />}
    </>
  );
}

type Row = { key: number; ingredientId: number | ""; qty: string };

function RecipeEditor({ dish, ingredients, onClose }: { dish: RecipeDish; ingredients: Ingredient[]; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [pending, act] = useAction();
  const [rows, setRows] = useState<Row[]>(() =>
    dish.recipe.length
      ? dish.recipe.map((r, i) => ({ key: i, ingredientId: r.ingredientId, qty: formatQty(r.qty).replace(/ /g, "") }))
      : [{ key: 0, ingredientId: "", qty: "" }],
  );
  const byId = new Map(ingredients.map((i) => [i.id, i]));

  const lines = rows.map((r) => {
    const ing = r.ingredientId ? byId.get(r.ingredientId) : undefined;
    const q = parseQty(r.qty);
    return { ...r, ing, q, cost: ing && q ? q * ing.lastPrice : 0 };
  });
  const cost = Math.round(lines.reduce((s, l) => s + l.cost, 0));
  const margin = dish.price ? Math.round(((dish.price - cost) / dish.price) * 100) : 0;
  const filled = lines.filter((l) => l.ingredientId !== "" || l.qty !== "");
  const valid = filled.every((l) => l.ing && l.q && l.q > 0) && new Set(filled.map((l) => l.ingredientId)).size === filled.length;

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <Modal
      open
      onClose={onClose}
      title={fmt(t.stock.recipeTitle, { name: pickName(dish, locale) })}
      width={680}
      footer={
        <>
          <div className="num mr-auto flex items-baseline gap-5">
            <span>
              <span className="text-sm text-muted">{t.stock.cost} </span>
              <span className="font-display text-xl font-semibold">{formatMoney(cost)}</span>
            </span>
            <span>
              <span className="text-sm text-muted">{t.stock.margin} </span>
              <span className={`font-display text-xl font-semibold ${marginClass(margin)}`}>{margin}%</span>
            </span>
          </div>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button
            variant="primary"
            disabled={pending || !valid}
            onClick={() =>
              act(() => saveRecipe(dish.id, filled.map((l) => ({ ingredientId: Number(l.ingredientId), qty: l.q! }))), { success: t.common.saved, onOk: onClose })
            }
          >
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2 pb-2">
        <div className="grid grid-cols-[1fr_130px_100px_40px] gap-2 px-1 text-xs text-muted">
          <span>{t.stock.product}</span>
          <span>{t.stock.perPortion}</span>
          <span className="text-right">{t.stock.cost}</span>
          <span />
        </div>
        {lines.map((l) => (
          <div key={l.key} className="grid grid-cols-[1fr_130px_100px_40px] items-center gap-2">
            <Select value={l.ingredientId} onChange={(e) => update(l.key, { ingredientId: e.target.value ? Number(e.target.value) : "" })} className="h-11">
              <option value="">—</option>
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>
                  {pickName(i, locale)}
                </option>
              ))}
            </Select>
            <div className="relative">
              <input
                value={l.qty}
                onChange={(e) => update(l.key, { qty: e.target.value })}
                inputMode="decimal"
                placeholder="0,15"
                className="num h-11 w-full rounded-[var(--radius-btn)] border border-line bg-surface-2 pl-3 pr-10 focus:border-saffron focus:outline-none"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{l.ing ? t.units[l.ing.unit as "KG"] : ""}</span>
            </div>
            <span className="num text-right text-sm">{l.cost ? formatMoney(Math.round(l.cost), { currency: false }) : "—"}</span>
            <button type="button" onClick={() => setRows((rs) => rs.filter((r) => r.key !== l.key))} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-pomegranate/10 hover:text-pomegranate" aria-label={t.common.delete}>
              <X size={16} />
            </button>
          </div>
        ))}
        <Button size="sm" variant="ghost" className="self-start" onClick={() => setRows((rs) => [...rs, { key: Math.max(0, ...rs.map((r) => r.key)) + 1, ingredientId: "", qty: "" }])}>
          <Plus size={16} />
          {t.stock.addRow}
        </Button>
      </div>
    </Modal>
  );
}
