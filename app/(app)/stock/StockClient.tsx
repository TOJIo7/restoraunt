"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Info } from "lucide-react";
import { useI18n } from "@/components/Providers";
import { PageHeader } from "@/components/shell/PageHeader";
import { fmt } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import type { Ingredient, Movement, ReceiptRow, RecipeDish, Supplier } from "./types";
import { stockLevel } from "./types";
import { StockList } from "./StockList";
import { Recipes } from "./Recipes";
import { ReceiptForm } from "./ReceiptForm";
import { WriteOff } from "./WriteOff";
import { Inventory } from "./Inventory";
import { History } from "./History";

export type StockTab = "stock" | "recipes" | "receipt" | "writeoff" | "inventory" | "history";

export function StockClient(props: {
  tab: StockTab;
  tabs: StockTab[];
  isOwner: boolean;
  ingredients: Ingredient[];
  dishes?: RecipeDish[];
  suppliers?: Supplier[];
  receipts?: ReceiptRow[];
  movements?: Movement[];
}) {
  const { t } = useI18n();
  const { tab, tabs, isOwner, ingredients } = props;
  const totalValue = ingredients.reduce((s, i) => s + Math.max(i.stock, 0) * i.lastPrice, 0);
  const low = ingredients.filter((i) => stockLevel(i) !== "ok").length;

  return (
    <>
      <PageHeader
        title={t.nav.stock}
        subtitle={`${t.stock.totalValue} ${formatMoney(Math.round(totalValue))}${low ? ` · ${fmt(t.stock.lowCount, { n: low })}` : ""}`}
      />
      {!isOwner && (
        <p className="mb-5 flex items-center gap-2 text-sm text-muted">
          <Info size={16} strokeWidth={1.75} className="text-lapis" />
          {t.stock.cashierHint}
        </p>
      )}

      <nav className="no-scrollbar mb-6 flex gap-1.5 overflow-x-auto">
        {tabs.map((id) => (
          <Link
            key={id}
            href={`/stock?tab=${id}`}
            className={`relative inline-flex h-12 shrink-0 items-center rounded-[var(--radius-btn)] px-4 text-[15px] font-medium transition-colors ${
              tab === id ? "text-text" : "text-muted hover:bg-surface-2 hover:text-text"
            }`}
          >
            {tab === id && <motion.span layoutId="stock-tab" className="absolute inset-0 rounded-[var(--radius-btn)] border border-saffron/35 bg-saffron/10" />}
            <span className="relative">{t.stock.tabs[id]}</span>
          </Link>
        ))}
      </nav>

      {tab === "stock" && <StockList ingredients={ingredients} isOwner={isOwner} />}
      {tab === "recipes" && <Recipes dishes={props.dishes ?? []} ingredients={ingredients} />}
      {tab === "receipt" && <ReceiptForm ingredients={ingredients} suppliers={props.suppliers ?? []} receipts={props.receipts ?? []} />}
      {tab === "writeoff" && <WriteOff ingredients={ingredients} movements={props.movements ?? []} />}
      {tab === "inventory" && <Inventory ingredients={ingredients} />}
      {tab === "history" && <History movements={props.movements ?? []} />}
    </>
  );
}
