// Расчёт суммы заказа. Общий для сервера и интерфейса — чтобы цифры на экране и в базе совпадали.
// Всё в дирамах, целыми числами.
import { applyBp } from "./money";

export type TotalsInput = {
  items: { qty: number; price: number; removed?: boolean }[];
  type: string; // DINE_IN | TAKEAWAY | DELIVERY
  discountType: string | null; // PERCENT | AMOUNT
  discountValue: number; // PERCENT — базисные пункты, AMOUNT — дирамы
  serviceChargeBp: number;
  deliveryFee?: number;
  prepaymentApplied?: number;
};

export type Totals = {
  subtotal: number;
  discountAmount: number;
  serviceAmount: number;
  deliveryFee: number;
  total: number;
  prepaymentApplied: number;
  /** сколько осталось заплатить */
  due: number;
};

export function computeTotals(o: TotalsInput): Totals {
  const subtotal = o.items.filter((i) => !i.removed).reduce((s, i) => s + i.qty * i.price, 0);
  let discountAmount = 0;
  if (o.discountType === "PERCENT") discountAmount = applyBp(subtotal, Math.min(o.discountValue, 10000));
  if (o.discountType === "AMOUNT") discountAmount = Math.min(o.discountValue, subtotal);
  // обслуживание — только в зале, считается от суммы после скидки
  const serviceAmount = o.type === "DINE_IN" ? applyBp(subtotal - discountAmount, o.serviceChargeBp) : 0;
  const deliveryFee = o.type === "DELIVERY" ? (o.deliveryFee ?? 0) : 0;
  const total = subtotal - discountAmount + serviceAmount + deliveryFee;
  const prepaymentApplied = Math.min(o.prepaymentApplied ?? 0, total);
  return { subtotal, discountAmount, serviceAmount, deliveryFee, total, prepaymentApplied, due: total - prepaymentApplied };
}

/** Сколько минут после добавления блюдо можно убрать без причины (исправление ошибки ввода). */
export const FREE_REMOVE_MINUTES = 5;

export const REMOVE_REASONS = ["mistake", "refused", "longWait", "quality", "other"] as const;
export const DISCOUNT_REASONS = ["regular", "staff", "birthday", "complaint", "other"] as const;
export const CANCEL_REASONS = ["guestLeft", "mistake", "duplicate", "other"] as const;
export const TRANSFER_PROVIDERS = ["Алиф", "Душанбе Сити", "Эсхата", "Другое"] as const;
export const EXPENSE_CATEGORIES = ["PURCHASE", "UTILITIES", "RENT", "SALARY", "OTHER"] as const;
