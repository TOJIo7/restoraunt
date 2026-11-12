// Склад: себестоимость, списание по техкартам, автоматический стоп-лист.
// Количество продуктов — Float в единицах продукта; округляем до 0,001, чтобы не копились хвосты.
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** Себестоимость порции в дирамах: Σ количество × последняя цена закупки. */
export function dishCost(recipe: { qty: number; ingredient: { lastPrice: number } }[]) {
  return Math.round(recipe.reduce((s, r) => s + r.qty * r.ingredient.lastPrice, 0));
}

/** Маржа в процентах от цены (может быть отрицательной). */
export function marginPct(price: number, cost: number) {
  return price > 0 ? Math.round(((price - cost) / price) * 100) : 0;
}

/**
 * Списание продуктов при оплате заказа.
 * Остаток может уйти в минус — продажу не блокируем (на кухне продукт мог быть, а приход забыли внести),
 * но такой продукт будет виден на складе красным.
 */
export async function applySale(tx: Tx, orderId: number, userId: number) {
  const items = await tx.orderItem.findMany({
    where: { orderId, removed: false },
    include: { dish: { include: { recipe: { include: { ingredient: true } } } } },
  });

  const need = new Map<number, { qty: number; price: number }>();
  let costTotal = 0;
  for (const item of items) {
    const cost = dishCost(item.dish.recipe);
    costTotal += cost * item.qty;
    await tx.orderItem.update({ where: { id: item.id }, data: { costPrice: cost } });
    for (const r of item.dish.recipe) {
      const cur = need.get(r.ingredientId) ?? { qty: 0, price: r.ingredient.lastPrice };
      cur.qty += r.qty * item.qty;
      need.set(r.ingredientId, cur);
    }
  }

  for (const [ingredientId, { qty, price }] of need) {
    const ing = await tx.ingredient.findUniqueOrThrow({ where: { id: ingredientId } });
    await tx.ingredient.update({ where: { id: ingredientId }, data: { stock: round3(ing.stock - qty) } });
    await tx.stockMovement.create({
      data: { ingredientId, type: "SALE", qty: -round3(qty), price, orderId, createdById: userId },
    });
  }

  await tx.order.update({ where: { id: orderId }, data: { costTotal } });
  return refreshAutoStop(tx, [...need.keys()]);
}

/**
 * Пересчитать автоматический стоп-лист для блюд с этими продуктами
 * (или для всех, если список не передан).
 * Не хватает хотя бы одного продукта на порцию → блюдо в стоп-лист (autoStopped).
 * Продукт пришёл → блюдо, которое система сама остановила, возвращается в продажу.
 * Ручной стоп-лист не трогаем.
 */
export async function refreshAutoStop(tx: Tx, ingredientIds?: number[]) {
  const dishes = await tx.dish.findMany({
    where: {
      active: true,
      recipe: ingredientIds ? { some: { ingredientId: { in: ingredientIds } } } : { some: {} },
    },
    include: { recipe: { include: { ingredient: true } } },
  });
  const stopped: string[] = [];
  const resumed: string[] = [];
  for (const d of dishes) {
    const enough = d.recipe.every((r) => r.ingredient.stock + 1e-9 >= r.qty);
    if (!enough && !d.inStopList) {
      await tx.dish.update({ where: { id: d.id }, data: { inStopList: true, autoStopped: true } });
      stopped.push(d.nameRu);
    } else if (enough && d.autoStopped) {
      await tx.dish.update({ where: { id: d.id }, data: { inStopList: false, autoStopped: false } });
      resumed.push(d.nameRu);
    }
  }
  return { stopped, resumed };
}
