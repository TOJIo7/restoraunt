"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SITE, deliveryFeeFor } from "@/lib/site";
import type { SiteDish } from "./SiteClient";

const KEY = "rohat-cart";
type Line = { dishId: number; qty: number };

type CartCtx = {
  lines: (Line & { dish: SiteDish })[];
  count: number;
  subtotal: number;
  qtyOf: (id: number) => number;
  add: (id: number) => void;
  dec: (id: number) => void;
  clear: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  /** с доставкой или самовывоз — влияет на итог */
  deliveryFee: (type: "DELIVERY" | "TAKEAWAY") => number;
};

const Ctx = createContext<CartCtx | null>(null);

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("CartProvider missing");
  return c;
}

export function CartProvider({ dishes, children }: { dishes: SiteDish[]; children: React.ReactNode }) {
  const byId = useMemo(() => new Map(dishes.map((d) => [d.id, d])), [dishes]);
  const [raw, setRaw] = useState<Line[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // корзина переживает перезагрузку страницы (если браузер разрешает хранилище)
  useEffect(() => {
    let saved: Line[] = [];
    try {
      saved = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- читаем внешнее хранилище один раз после монтирования
    setRaw(Array.isArray(saved) ? saved.filter((l) => typeof l?.dishId === "number" && l.qty > 0) : []);
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(raw));
    } catch {}
  }, [raw, loaded]);

  // блюда, которых больше нет в меню или они в стоп-листе, из корзины выпадают
  const lines = useMemo(
    () => raw.flatMap((l) => {
      const dish = byId.get(l.dishId);
      return dish && !dish.stopped ? [{ ...l, dish }] : [];
    }),
    [raw, byId],
  );
  const subtotal = lines.reduce((s, l) => s + l.dish.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  const add = useCallback((id: number) => {
    setRaw((r) => {
      const i = r.findIndex((l) => l.dishId === id);
      if (i < 0) return [...r, { dishId: id, qty: 1 }];
      return r.map((l, k) => (k === i ? { ...l, qty: Math.min(50, l.qty + 1) } : l));
    });
  }, []);
  const dec = useCallback((id: number) => {
    setRaw((r) => r.flatMap((l) => (l.dishId !== id ? [l] : l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : [])));
  }, []);
  const clear = useCallback(() => setRaw([]), []);
  const qtyOf = useCallback((id: number) => raw.find((l) => l.dishId === id)?.qty ?? 0, [raw]);
  const deliveryFee = useCallback((type: "DELIVERY" | "TAKEAWAY") => (type === "DELIVERY" ? deliveryFeeFor(subtotal) : 0), [subtotal]);

  return (
    <Ctx.Provider value={{ lines, count, subtotal, qtyOf, add, dec, clear, open, setOpen, deliveryFee }}>{children}</Ctx.Provider>
  );
}

export const MIN_ORDER = SITE.minOrder;
