export type Ingredient = { id: number; nameRu: string; nameTg: string; unit: string; stock: number; minStock: number; lastPrice: number };

export type RecipeDish = {
  id: number;
  nameRu: string;
  nameTg: string;
  categoryRu: string;
  categoryTg: string;
  price: number;
  cost: number;
  margin: number;
  autoStopped: boolean;
  recipe: { ingredientId: number; qty: number }[];
};

export type Supplier = { id: number; name: string };
export type ReceiptRow = { id: number; date: string; supplier: string | null; total: number; items: number; by: string };

export type Movement = {
  id: number;
  at: string;
  type: string;
  nameRu: string;
  nameTg: string;
  unit: string;
  qty: number;
  value: number;
  reason: string | null;
  orderNumber: number | null;
  orderId: number | null;
  by: string;
};

/** Статус остатка: минус / мало / норма */
export function stockLevel(i: Ingredient): "negative" | "low" | "ok" {
  if (i.stock < 0) return "negative";
  if (i.stock < i.minStock) return "low";
  return "ok";
}
