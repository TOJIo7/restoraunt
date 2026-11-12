"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2, Info } from "lucide-react";
import { useAction, useI18n } from "@/components/Providers";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/Ornament";
import { fmt, pickName } from "@/lib/i18n";
import { deleteCategory, moveCategory } from "@/app/actions/menu";
import { DishCard } from "./DishCard";
import { DishForm } from "./DishForm";
import { CategoryForm } from "./CategoryForm";

export type MenuDish = {
  id: number;
  categoryId: number;
  nameRu: string;
  nameTg: string;
  descriptionRu: string | null;
  descriptionTg: string | null;
  price: number;
  photo: string | null;
  inStopList: boolean;
};
export type MenuCategory = { id: number; nameRu: string; nameTg: string; dishes: MenuDish[] };

export function MenuClient({ categories, canEdit }: { categories: MenuCategory[]; canEdit: boolean }) {
  const { t, locale } = useI18n();
  const [active, setActive] = useState<number | "all">("all");
  const [query, setQuery] = useState("");
  const [dishForm, setDishForm] = useState<{ open: boolean; dish?: MenuDish }>({ open: false });
  const [catForm, setCatForm] = useState<{ open: boolean; category?: MenuCategory }>({ open: false });
  const [pending, act] = useAction();

  // категория могла исчезнуть после удаления
  const activeId = active !== "all" && categories.some((c) => c.id === active) ? active : "all";

  const all = categories.flatMap((c) => c.dishes);
  const stopped = all.filter((d) => d.inStopList).length;

  // поиск по обоим языкам, без учёта регистра
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories
      .filter((c) => activeId === "all" || c.id === activeId)
      .map((c) => ({
        ...c,
        dishes: q ? c.dishes.filter((d) => `${d.nameRu} ${d.nameTg}`.toLowerCase().includes(q)) : c.dishes,
      }))
      .filter((c) => c.dishes.length > 0 || (!q && activeId !== "all"));
  }, [categories, activeId, query]);

  const activeCategory = activeId === "all" ? null : categories.find((c) => c.id === activeId)!;
  const activeIndex = activeCategory ? categories.indexOf(activeCategory) : -1;

  return (
    <>
      <PageHeader
        title={t.nav.menu}
        subtitle={fmt(t.menu.summary, { dishes: all.length, stopped })}
        actions={
          canEdit && (
            <>
              <Button onClick={() => setCatForm({ open: true })}>
                <Plus size={18} strokeWidth={1.75} />
                {t.menu.addCategory}
              </Button>
              <Button variant="primary" onClick={() => setDishForm({ open: true })} disabled={categories.length === 0}>
                <Plus size={18} strokeWidth={2} />
                {t.menu.addDish}
              </Button>
            </>
          )
        }
      />

      {!canEdit && (
        <p className="mb-5 flex items-center gap-2 text-sm text-muted">
          <Info size={16} strokeWidth={1.75} className="text-lapis" />
          {t.menu.cashierHint}
        </p>
      )}

      {/* Поиск + категории */}
      <div className="sticky top-[78px] z-20 -mx-8 mb-6 border-b border-line/60 bg-bg/90 px-8 pb-4 pt-1 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search size={18} strokeWidth={1.75} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.menu.search}
              className="h-12 w-full rounded-[var(--radius-btn)] border border-line bg-surface pl-11 pr-4 transition-colors placeholder:text-muted/70 focus:border-saffron focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[{ id: "all" as const, label: t.menu.all }, ...categories.map((c) => ({ id: c.id, label: pickName(c, locale) }))].map(
              (c) => {
                const on = activeId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActive(c.id)}
                    className={`relative h-12 rounded-[var(--radius-btn)] px-4 text-[15px] font-medium transition-colors ${
                      on ? "text-on-saffron" : "text-muted hover:bg-surface-2 hover:text-text"
                    }`}
                  >
                    {on && (
                      <motion.span
                        layoutId="menu-cat"
                        className="absolute inset-0 rounded-[var(--radius-btn)] bg-saffron"
                        transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      />
                    )}
                    <span className="relative">{c.label}</span>
                  </button>
                );
              },
            )}
          </div>
        </div>

        {canEdit && activeCategory && (
          <div className="mt-3 flex flex-wrap items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setCatForm({ open: true, category: activeCategory })}>
              <Pencil size={16} strokeWidth={1.75} />
              {t.common.edit}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending || activeIndex <= 0} onClick={() => act(() => moveCategory(activeCategory.id, -1))}>
              <ChevronLeft size={16} strokeWidth={1.75} />
              {t.menu.moveUp}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending || activeIndex >= categories.length - 1}
              onClick={() => act(() => moveCategory(activeCategory.id, 1))}
            >
              {t.menu.moveDown}
              <ChevronRight size={16} strokeWidth={1.75} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="hover:!bg-pomegranate/10 hover:!text-pomegranate"
              disabled={pending}
              onClick={() => act(() => deleteCategory(activeCategory.id), { success: t.common.saved, onOk: () => setActive("all") })}
            >
              <Trash2 size={16} strokeWidth={1.75} />
              {t.menu.deleteCategory}
            </Button>
          </div>
        )}
      </div>

      {groups.length === 0 || groups.every((g) => g.dishes.length === 0) ? (
        <EmptyState title={t.menu.empty} text={query ? `«${query}»` : ""} />
      ) : (
        <div className="flex flex-col gap-10">
          {groups.map((g) => (
            <section key={g.id}>
              {activeId === "all" && (
                <h2 className="mb-4 flex items-baseline gap-3 font-display text-lg font-semibold">
                  {pickName(g, locale)}
                  <span className="num text-sm font-normal text-muted">{g.dishes.length}</span>
                </h2>
              )}
              <motion.div layout className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
                <AnimatePresence mode="popLayout">
                  {g.dishes.map((d, i) => (
                    <DishCard
                      key={d.id}
                      dish={d}
                      index={i}
                      categoryIndex={categories.findIndex((c) => c.id === d.categoryId)}
                      canEdit={canEdit}
                      onEdit={() => setDishForm({ open: true, dish: d })}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            </section>
          ))}
        </div>
      )}

      <DishForm
        key={dishForm.dish?.id ?? `new-${dishForm.open}`}
        open={dishForm.open}
        dish={dishForm.dish}
        categories={categories}
        defaultCategoryId={activeId === "all" ? categories[0]?.id : activeId}
        onClose={() => setDishForm({ open: false })}
      />
      <CategoryForm
        key={catForm.category?.id ?? `newcat-${catForm.open}`}
        open={catForm.open}
        category={catForm.category}
        onClose={() => setCatForm({ open: false })}
      />
    </>
  );
}
