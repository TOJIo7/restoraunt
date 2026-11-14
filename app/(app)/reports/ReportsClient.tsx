"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useInView } from "motion/react";
import { BarChart3, FileSpreadsheet, Plus, Table2, Trash2, TriangleAlert } from "lucide-react";
import { useAction, useI18n } from "@/components/Providers";
import { PageHeader } from "@/components/shell/PageHeader";
import { PeriodPicker } from "@/components/ui/PeriodPicker";
import { Card } from "@/components/ui/Card";
import { RevealStack } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { FieldLabel, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/Ornament";
import { CountUp } from "@/components/charts/CountUp";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { Parts, RankBars } from "@/components/charts/Parts";
import { fmt, pickName } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { ddmm, formatQty } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/orders";
import { addExpense, deleteExpense } from "@/app/actions/expenses";
import type { Report } from "@/lib/reports";

export type ReportTab = "summary" | "dishes" | "expenses" | "profit" | "stock";
const NOT_IN_PROFIT = ["PURCHASE", "SALARY"];

export function ReportsClient({ tab, period, from, to, report }: { tab: ReportTab; period: string; from: string; to: string; report: Report }) {
  const { t } = useI18n();
  const qs = `period=${period}&from=${from}&to=${to}`;
  const tabs: ReportTab[] = ["summary", "dishes", "expenses", "profit", "stock"];

  return (
    <>
      <PageHeader
        title={t.nav.reports}
        actions={
          // скачивание — обычная ссылка на выгрузку
          <a
            href={`/api/reports/export?${qs}`}
            className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-btn)] border border-line bg-surface-2 px-5 font-semibold transition-[background-color,transform] hover:bg-line/60 active:scale-[0.97]"
          >
            <FileSpreadsheet size={18} strokeWidth={1.75} className="text-mint" />
            {t.reports.excel}
          </a>
        }
      />

      <nav className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto">
        {tabs.map((id) => (
          <Link
            key={id}
            href={`/reports?tab=${id}&${qs}`}
            className={`relative inline-flex h-12 shrink-0 items-center rounded-[var(--radius-btn)] px-4 text-[15px] font-medium transition-colors ${tab === id ? "text-text" : "text-muted hover:bg-surface-2 hover:text-text"}`}
          >
            {tab === id && <motion.span layoutId="reports-tab" className="absolute inset-0 rounded-[var(--radius-btn)] border border-saffron/35 bg-saffron/10" />}
            <span className="relative">{t.reports.tabs[id]}</span>
          </Link>
        ))}
      </nav>
      {/* фильтр периода — один ряд над всем, что он фильтрует */}
      <PeriodPicker base={`/reports?tab=${tab}`} period={period} from={from} to={to} />

      {tab === "summary" && <Summary r={report} />}
      {tab === "dishes" && <Dishes r={report} />}
      {tab === "expenses" && <Expenses r={report} />}
      {tab === "profit" && <Profit r={report} />}
      {tab === "stock" && <StockReport r={report} />}
    </>
  );
}

function Tile({ label, children, sub }: { label: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold">{children}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </Card>
  );
}

/** Крупная выручка ушла за верх экрана — компактная копия «уезжает» в шапку. */
function StickyRevenue({ value, label, watch }: { value: number; label: string; watch: React.RefObject<HTMLDivElement | null> }) {
  const visible = useInView(watch, { margin: "-80px 0px 0px 0px" });
  // до первой проверки useInView даёт false — не показываем копию, пока цифру не увидели
  const [seen, setSeen] = useState(false);
  if (visible && !seen) setSeen(true);
  return (
    <div className="pointer-events-none fixed left-[calc(50%+116px)] top-3 z-40 -translate-x-1/2">
      <AnimatePresence>
        {seen && !visible && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 1.25 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 1.25 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex h-10 items-center gap-3 rounded-full border border-saffron/30 bg-surface px-4 shadow-[0_0_24px_var(--glow)]"
          >
            <span className="text-xs text-muted">{label}</span>
            <span className="num font-display text-lg font-semibold">{formatMoney(value)}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- Сводка ----------

function Summary({ r }: { r: Report }) {
  const { t, locale } = useI18n();
  const [asTable, setAsTable] = useState(false);
  const bigRef = useRef<HTMLDivElement>(null);
  const s = r.summary;
  const cols = r.series.map((x) => ({
    key: x.key,
    label: r.oneDay ? x.key : new Date(`${x.key}T12:00:00`).getDate().toString(),
    value: x.revenue,
    detail: `${fmt(t.reports.ordersCount, { n: x.orders })}${r.oneDay ? "" : ` · ${new Date(`${x.key}T12:00:00`).toLocaleDateString(locale === "tg" ? "tg-TJ" : "ru-RU", { weekday: "short", day: "numeric", month: "short" })}`}`,
  }));

  if (s.orders === 0) return <EmptyState title={t.reports.noData} text="" />;
  return (
    <>
    <StickyRevenue value={s.revenue} label={t.reports.revenue} watch={bigRef} />
    <RevealStack className="flex flex-col gap-5">
      <RevealStack className="grid gap-4 lg:grid-cols-[1.9fr_1fr_1fr_1fr]">
        {/* главная цифра — одна на экран, крупно */}
        <Card className="relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[radial-gradient(circle,var(--glow),transparent_70%)]" />
          <div className="text-muted">{t.reports.revenue}</div>
          <div ref={bigRef}>
            <CountUp value={s.revenue} className="mt-1 block whitespace-nowrap font-display text-[clamp(30px,3.1vw,48px)] font-semibold leading-tight" />
          </div>
        </Card>
        <Tile label={t.reports.orders}>
          <CountUp value={s.orders} money={false} />
        </Tile>
        <Tile label={t.reports.avgCheck}>
          <CountUp value={s.avg} currency={false} />
        </Tile>
        <Tile label={t.reports.grossProfit} sub={`${t.reports.cost} ${formatMoney(s.cost)}`}>
          <CountUp value={s.grossProfit} currency={false} />
        </Tile>
      </RevealStack>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{r.oneDay ? t.reports.byHour : t.reports.byDay}</h2>
          <Button size="sm" variant="ghost" onClick={() => setAsTable(!asTable)}>
            {asTable ? <BarChart3 size={16} strokeWidth={1.75} /> : <Table2 size={16} strokeWidth={1.75} />}
            {asTable ? t.reports.chart : t.reports.table}
          </Button>
        </div>
        {asTable ? (
          <div className="max-h-[260px] overflow-y-auto">
            <table className="num w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-1.5 font-medium">{r.oneDay ? t.reports.hour : t.reports.date}</th>
                  <th className="py-1.5 text-right font-medium">{t.reports.orders}</th>
                  <th className="py-1.5 text-right font-medium">{t.reports.revenue}</th>
                </tr>
              </thead>
              <tbody>
                {r.series.map((x) => (
                  <tr key={x.key} className="border-t border-line">
                    <td className="py-1.5">{r.oneDay ? `${x.key}:00` : ddmm(`${x.key}T12:00:00`)}</td>
                    <td className="py-1.5 text-right">{x.orders}</td>
                    <td className="py-1.5 text-right font-semibold">{formatMoney(x.revenue, { currency: false })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ColumnChart data={cols} ariaLabel={r.oneDay ? t.reports.byHour : t.reports.byDay} />
        )}
      </Card>

      <RevealStack className="grid gap-5 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">{t.reports.byMethod}</h2>
          <Parts ariaLabel={t.reports.byMethod} parts={Object.entries(s.byMethod).map(([k, v]) => ({ key: k, label: t.payMethod[k as "CASH"], value: v }))} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">{t.reports.byType}</h2>
          <Parts ariaLabel={t.reports.byType} parts={Object.entries(s.byType).map(([k, v]) => ({ key: k, label: t.orderType[k as "DINE_IN"], value: v }))} />
          {s.cancelled > 0 && (
            <p className="mt-3 text-xs text-muted">
              {t.reports.cancelled}: {s.cancelled}
            </p>
          )}
        </Card>
      </RevealStack>
    </RevealStack>
    </>
  );
}

// ---------- Блюда ----------

function Dishes({ r }: { r: Report }) {
  const { t, locale } = useI18n();
  const [sort, setSort] = useState<"profit" | "revenue" | "qty">("profit");
  if (r.dishes.length === 0) return <EmptyState title={t.reports.noData} text="" />;
  const sorted = [...r.dishes].sort((a, b) => b[sort] - a[sort]);
  const byProfit = [...r.dishes].sort((a, b) => b.profit - a.profit).slice(0, 8);
  const byQty = [...r.dishes].sort((a, b) => b.qty - a.qty).slice(0, 8);
  const marginCls = (m: number) => (m < 30 ? "text-pomegranate" : m < 55 ? "text-apricot" : "text-mint");

  return (
    <RevealStack className="flex flex-col gap-5">
      <RevealStack className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">{t.reports.topProfit}</h2>
          <RankBars ariaLabel={t.reports.topProfit} rows={byProfit.map((d) => ({ key: String(d.id), label: pickName(d, locale), value: d.profit, sub: `${d.margin}%` }))} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">{t.reports.topSold}</h2>
          <RankBars ariaLabel={t.reports.topSold} unit={t.units.PCS} rows={byQty.map((d) => ({ key: String(d.id), label: pickName(d, locale), value: d.qty }))} />
        </Card>
      </RevealStack>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted">{t.reports.sortBy}:</span>
        {(["profit", "revenue", "qty"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setSort(k)}
            className={`h-9 rounded-lg px-3 transition-colors ${sort === k ? "bg-saffron/12 font-semibold text-saffron" : "text-muted hover:bg-surface-2"}`}
          >
            {k === "profit" ? t.reports.byProfit : k === "revenue" ? t.reports.byRevenue : t.reports.byQty}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
        <table className="w-full text-[15px]">
          <thead className="bg-surface text-right text-sm text-muted">
            <tr>
              <th className="px-4 py-3 text-left font-medium">{t.reports.dish}</th>
              <th className="px-4 py-3 font-medium">{t.reports.sold}</th>
              <th className="px-4 py-3 font-medium">{t.reports.revenue}</th>
              <th className="px-4 py-3 font-medium">{t.reports.cost}</th>
              <th className="px-4 py-3 font-medium">{t.reports.profit}</th>
              <th className="px-4 py-3 font-medium">{t.reports.margin}</th>
            </tr>
          </thead>
          <tbody className="num text-right">
            {sorted.map((d) => (
              <tr key={d.id} className="border-t border-line">
                <td className="px-4 py-2.5 text-left font-sans">
                  <span className="font-medium">{pickName(d, locale)}</span>
                  <span className="text-xs text-muted"> · {locale === "tg" ? d.categoryTg : d.categoryRu}</span>
                </td>
                <td className="px-4 py-2.5">{d.qty}</td>
                <td className="px-4 py-2.5">{formatMoney(d.revenue, { currency: false })}</td>
                <td className="px-4 py-2.5 text-muted">{formatMoney(d.cost, { currency: false })}</td>
                <td className="px-4 py-2.5 font-semibold">{formatMoney(d.profit, { currency: false })}</td>
                <td className={`px-4 py-2.5 font-semibold ${marginCls(d.margin)}`}>{d.margin}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </RevealStack>
  );
}

// ---------- Расходы ----------

function Expenses({ r }: { r: Report }) {
  const { t } = useI18n();
  const [pending, act] = useAction();
  const [add, setAdd] = useState(false);
  const e = r.expenses;
  return (
    <RevealStack className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
      <Card className="p-5">
        <div className="text-sm text-muted">{t.reports.expensesTotal}</div>
        <CountUp value={e.total} className="mb-5 mt-1 block font-display text-4xl font-semibold" />
        <Parts ariaLabel={t.reports.expensesTotal} parts={EXPENSE_CATEGORIES.map((c) => ({ key: c, label: t.cash.expenseCategory[c], value: e.byCat[c] ?? 0 }))} />
        <p className="mt-4 text-xs text-muted">
          {t.cash.expenseCategory.PURCHASE}, {t.cash.expenseCategory.SALARY.toLowerCase()} — {t.reports.notInProfit}. {t.reports.plNote}
        </p>
      </Card>
      <Card className="p-5">
        <div className="mb-3 flex items-start justify-between gap-4">
          <p className="text-sm text-muted">{t.reports.expenseHint}</p>
          <Button onClick={() => setAdd(true)}>
            <Plus size={18} strokeWidth={1.75} />
            {t.reports.addExpense}
          </Button>
        </div>
        {e.list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{t.reports.noExpenses}</p>
        ) : (
          <ul className="num flex max-h-[460px] flex-col overflow-y-auto">
            {e.list.map((x) => (
              <li key={x.id} className="group flex items-center gap-3 border-t border-line py-2.5 text-sm first:border-t-0">
                <span className="w-12 text-muted">{ddmm(x.date)}</span>
                <span className="min-w-0 flex-1 truncate font-sans">
                  {t.cash.expenseCategory[x.category as "OTHER"]}
                  {x.comment && <span className="text-muted"> · {x.comment}</span>}
                  {x.fromCash && <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">{t.reports.fromCash}</span>}
                </span>
                <span className={`font-semibold ${NOT_IN_PROFIT.includes(x.category) ? "text-muted" : ""}`}>{formatMoney(x.amount, { currency: false })}</span>
                {!x.fromCash ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => act(() => deleteExpense(x.id))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted opacity-0 transition-opacity hover:bg-pomegranate/10 hover:text-pomegranate group-hover:opacity-100"
                    aria-label={t.common.delete}
                  >
                    <Trash2 size={14} />
                  </button>
                ) : (
                  <span className="w-8" />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {add && <AddExpense onClose={() => setAdd(false)} />}
    </RevealStack>
  );
}

function AddExpense({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [pending, act] = useAction();
  const today = new Date();
  const [v, setV] = useState({
    category: "RENT",
    amount: "",
    date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
    comment: "",
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={t.reports.addExpense}
      width={480}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" disabled={pending || !v.amount} onClick={() => act(() => addExpense(v), { success: t.common.saved, onOk: onClose })}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 pb-2">
        <FieldLabel label={t.cash.category}>
          <Select value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t.cash.expenseCategory[c]}
              </option>
            ))}
          </Select>
        </FieldLabel>
        <Input label={`${t.pay.amount}, TJS`} value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} inputMode="decimal" className="num" autoFocus />
        <Input label={t.reports.date} type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
        <Input label={t.orders.comment} value={v.comment} onChange={(e) => setV({ ...v, comment: e.target.value })} maxLength={200} />
      </div>
    </Modal>
  );
}

// ---------- Прибыль ----------

function Profit({ r }: { r: Report }) {
  const { t } = useI18n();
  const p = r.profit;
  const rows: { label: string; value: number; sign: string; strong?: boolean }[] = [
    { label: t.reports.plRevenue, value: p.revenue, sign: "" },
    { label: t.reports.plCost, value: -p.cost, sign: "−" },
    { label: t.reports.plGross, value: p.grossProfit, sign: "=", strong: true },
    { label: t.reports.plExpenses, value: -p.expenses, sign: "−" },
    { label: t.reports.plSalary, value: -p.salary, sign: "−" },
  ];
  const marginPct = p.revenue ? Math.round((p.profit / p.revenue) * 100) : 0;
  const max = Math.max(1, p.revenue);

  return (
    <RevealStack className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <Card className="p-6">
        <h2 className="mb-5 font-display text-lg font-semibold">{t.reports.pl}</h2>
        <ul className="flex flex-col gap-3">
          {rows.map((row, i) => (
            <li key={row.label} className={`grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 ${row.strong ? "border-t border-line pt-3" : ""}`}>
              <span className={row.strong ? "font-semibold" : "text-muted"}>
                <span className="num mr-2 inline-block w-3 text-muted">{row.sign}</span>
                {row.label}
              </span>
              <span className={`num ${row.strong ? "font-display text-lg font-semibold" : ""}`}>{formatMoney(Math.abs(row.value))}</span>
              {/* длина полосы — доля от выручки, одна шкала для всех строк */}
              <div className="col-span-2 h-2 rounded-full bg-surface-2">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: row.value < 0 ? "var(--chart-2)" : "var(--chart-1)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(Math.abs(row.value) / max) * 100}%` }}
                  transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex items-baseline justify-between border-t-2 border-line pt-4">
          <span className="font-display text-lg font-semibold">= {t.reports.plProfit}</span>
          <CountUp value={p.profit} className={`font-display text-4xl font-semibold ${p.profit < 0 ? "text-pomegranate" : "text-mint"}`} />
        </div>
      </Card>
      <div className="flex flex-col gap-4">
        <Tile label={t.reports.profitMargin}>
          <CountUp value={marginPct} money={false} suffix="%" />
        </Tile>
        <Card className="p-5 text-sm">
          <p className="mb-3 text-muted">{t.reports.plNote}</p>
          <div className="num flex justify-between">
            <span className="text-muted">{t.reports.plPurchases}</span>
            <span>{formatMoney(p.purchases)}</span>
          </div>
          <div className="num mt-1 flex justify-between">
            <span className="text-muted">{t.reports.plMonthly}</span>
            <span>{formatMoney(p.monthlyPart)}</span>
          </div>
          <div className="num mt-1 flex justify-between">
            <span className="text-muted">{t.reports.plSalaryPaid}</span>
            <span>{formatMoney(p.salaryPaid)}</span>
          </div>
        </Card>
      </div>
    </RevealStack>
  );
}

// ---------- Склад ----------

function StockReport({ r }: { r: Report }) {
  const { t, locale } = useI18n();
  const s = r.stock;
  return (
    <RevealStack className="flex flex-col gap-5">
      <RevealStack className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Tile label={t.reports.stockValue} sub={s.low ? <span className="inline-flex items-center gap-1 text-apricot"><TriangleAlert size={12} />{fmt(t.reports.lowNow, { n: s.low })}</span> : undefined}>
          <CountUp value={Math.round(s.value)} currency={false} />
        </Tile>
        <Tile label={t.reports.receipts}>
          <CountUp value={s.receipts} currency={false} />
        </Tile>
        <Tile label={t.reports.soldCost}>
          <CountUp value={s.sold} currency={false} />
        </Tile>
        <Tile label={t.reports.writeOffs}>
          <CountUp value={s.writeOffs} currency={false} />
        </Tile>
        <Tile label={t.reports.inventoryDiff}>
          <span className={s.inventory < 0 ? "text-pomegranate" : ""}>{formatMoney(s.inventory, { currency: false })}</span>
        </Tile>
      </RevealStack>
      <Card className="p-5">
        <h2 className="mb-4 font-display text-lg font-semibold">{t.reports.topLosses}</h2>
        {s.losses.length === 0 ? (
          <p className="text-sm text-muted">{t.reports.noLosses}</p>
        ) : (
          <RankBars
            ariaLabel={t.reports.topLosses}
            rows={s.losses.map((l) => ({ key: l.nameRu, label: pickName(l, locale), value: l.value, sub: `${formatQty(l.qty)} ${t.units[l.unit as "KG"]}` }))}
          />
        )}
      </Card>
    </RevealStack>
  );
}
