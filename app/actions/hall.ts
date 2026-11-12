"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/session";
import { HALL_COLS, HALL_ROWS, TABLE_SHAPES, tableSpan } from "@/lib/constants";
import { int, oneOf, run, ValidationError } from "@/lib/validate";

type Cell = { x: number; y: number; shape: string };

function occupiedCells(t: Cell) {
  return Array.from({ length: tableSpan(t.shape) }, (_, i) => `${t.x + i}:${t.y}`);
}

function assertNoOverlap(tables: (Cell & { id: number })[]) {
  const seen = new Set<string>();
  for (const t of tables) {
    if (t.x < 0 || t.y < 0 || t.y >= HALL_ROWS || t.x + tableSpan(t.shape) > HALL_COLS) throw new ValidationError("outOfHall");
    for (const c of occupiedCells(t)) {
      if (seen.has(c)) throw new ValidationError("tablesOverlap");
      seen.add(c);
    }
  }
}

/** Сохранить расстановку столов после перетаскивания (только владелец). */
export async function saveLayout(positions: { id: number; x: number; y: number }[]) {
  return run(async () => {
    const s = await requireSession(["OWNER"]);
    const tables = await db.diningTable.findMany({ where: { active: true } });
    const byId = new Map(positions.map((p) => [p.id, p]));
    const next = tables.map((t) => {
      const p = byId.get(t.id);
      return { id: t.id, shape: t.shape, x: p ? int(p.x, { max: HALL_COLS }) : t.x, y: p ? int(p.y, { max: HALL_ROWS }) : t.y };
    });
    assertNoOverlap(next);
    await db.$transaction(next.map((t) => db.diningTable.update({ where: { id: t.id }, data: { x: t.x, y: t.y } })));
    await audit(s.uid, "HALL_LAYOUT_SAVED", "DiningTable", null, { count: next.length });
    revalidatePath("/hall");
  });
}

/** Добавить или изменить стол: номер, места, форма. Новый стол встаёт в первую свободную клетку. */
export async function saveTable(input: { id?: number; number: number; seats: number; shape: string }) {
  return run(async () => {
    const s = await requireSession(["OWNER"]);
    const number = int(input.number, { min: 1, max: 999 });
    const seats = int(input.seats, { min: 1, max: 60 });
    const shape = oneOf(input.shape, TABLE_SHAPES);

    const dup = await db.diningTable.findUnique({ where: { number } });
    if (dup && dup.id !== input.id) {
      if (dup.active) throw new ValidationError("tableNumberTaken");
      // номер был у удалённого стола — освобождаем его
      await db.diningTable.update({ where: { id: dup.id }, data: { number: -dup.id } });
    }

    const others = (await db.diningTable.findMany({ where: { active: true } })).filter((t) => t.id !== input.id);

    if (input.id) {
      const cur = await db.diningTable.findUniqueOrThrow({ where: { id: int(input.id, { min: 1 }) } });
      assertNoOverlap([...others, { id: cur.id, x: cur.x, y: cur.y, shape }]);
      await db.diningTable.update({ where: { id: cur.id }, data: { number, seats, shape } });
      await audit(s.uid, "TABLE_UPDATED", "DiningTable", cur.id, { number, seats, shape });
    } else {
      let spot: { x: number; y: number } | null = null;
      outer: for (let y = 0; y < HALL_ROWS; y++) {
        for (let x = 0; x + tableSpan(shape) <= HALL_COLS; x++) {
          try {
            assertNoOverlap([...others, { id: 0, x, y, shape }]);
            spot = { x, y };
            break outer;
          } catch {}
        }
      }
      if (!spot) throw new ValidationError("hallFull");
      const t = await db.diningTable.create({ data: { number, seats, shape, ...spot } });
      await audit(s.uid, "TABLE_CREATED", "DiningTable", t.id, { number, seats, shape });
    }
    revalidatePath("/hall");
  });
}

/** Убрать стол со схемы. Нельзя, пока за ним открыт заказ. */
export async function archiveTable(id: number) {
  return run(async () => {
    const s = await requireSession(["OWNER"]);
    const open = await db.order.count({ where: { tableId: id, status: { in: ["OPEN", "BILL"] } } });
    if (open) throw new ValidationError("tableHasOrder");
    const t = await db.diningTable.update({ where: { id }, data: { active: false } });
    await audit(s.uid, "TABLE_ARCHIVED", "DiningTable", id, { number: t.number });
    revalidatePath("/hall");
  });
}
