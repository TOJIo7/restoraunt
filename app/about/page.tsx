import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getHall } from "@/lib/hall";
import { getSession } from "@/lib/session";
import { AboutClient } from "./AboutClient";

export const metadata: Metadata = { title: "О проекте — Роҳат" };

// Экран «О проекте» для защиты: при прокрутке камера облетает 3D-зал.
// Открывается без входа, поэтому показывает только общие цифры и относительную высоту столбцов (без сумм).
function monthAgo() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

export default async function AboutPage() {
  const since = monthAgo();
  const [session, tables, dishes, products, staff, byTable] = await Promise.all([
    getSession(),
    getHall(),
    db.dish.count({ where: { active: true } }),
    db.ingredient.count({ where: { active: true } }),
    db.employee.count({ where: { active: true } }),
    db.order.groupBy({ by: ["tableId"], where: { status: "PAID", paidAt: { gte: since }, tableId: { not: null } }, _sum: { total: true } }),
  ]);
  const max = Math.max(1, ...byTable.map((r) => r._sum.total ?? 0));
  const share = Object.fromEntries(byTable.map((r) => [r.tableId, (r._sum.total ?? 0) / max]));

  return (
    <AboutClient
      loggedIn={!!session}
      facts={{ dishes, products, staff, tables: tables.length }}
      tables={tables.map(({ id, number, seats, x, y, shape, status }) => ({ id, number, seats, x, y, shape, status, share: share[id] ?? 0 }))}
    />
  );
}
