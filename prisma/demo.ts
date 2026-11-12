// Демо-история за последние 30 дней — для отчётов, зарплаты и защиты проекта.
// Запуск: npm run db:demo. Не запускается, если в базе уже есть прошлые заказы.
// Склад не трогает: остатки и движения продуктов остаются как есть.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const DAYS = 30;

// воспроизводимый генератор случайных чисел
let seed = 20261112;
const rnd = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pickW = <T,>(items: [T, number][]) => {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of items) if ((r -= w) <= 0) return v;
  return items[items.length - 1][0];
};
const at = (day: Date, h: number, m = 0) => {
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
};

// популярность блюд (по умолчанию 1)
const POPULAR: Record<string, number> = {
  "Плов": 9, "Чай зелёный": 10, "Чай чёрный": 6, "Самбуса": 7, "Лепёшка": 8, "Лагман": 6, "Шашлык из баранины": 6,
  "Манты": 5, "Шакароб": 4, "Курутоб": 4, "Шурпо": 4, "Ачичук": 4, "Кола 0,5 л": 4, "Вода 0,5 л": 3, "Люля-кебаб": 3,
  "Плов свадебный": 2, "Самбуса тандырная": 3, "Компот": 3, "Дуғ": 2,
};

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstDay = new Date(today);
  firstDay.setDate(firstDay.getDate() - DAYS);

  if (await db.order.count({ where: { openedAt: { lt: today } } })) {
    console.log("В базе уже есть прошлые заказы — демо-история не нужна.");
    return;
  }

  const [employees, dishes, tables, cashier, settings] = await Promise.all([
    db.employee.findMany({ where: { active: true } }),
    db.dish.findMany({ where: { active: true }, include: { recipe: { include: { ingredient: true } } } }),
    db.diningTable.findMany({ where: { active: true } }),
    db.user.findFirstOrThrow({ where: { role: "CASHIER" } }),
    db.setting.findUnique({ where: { id: 1 } }),
  ]);
  const serviceBp = settings?.serviceChargeBp ?? 1000;
  const waiters = employees.filter((e) => e.position === "WAITER");
  const courier = employees.find((e) => e.position === "COURIER");
  const cost = (d: (typeof dishes)[number]) => Math.round(d.recipe.reduce((s, r) => s + r.qty * r.ingredient.lastPrice, 0));
  const weighted = dishes.map((d) => [d, POPULAR[d.nameRu] ?? 1] as [(typeof dishes)[number], number]);

  // ---------- График и посещаемость ----------
  // смены: официанты 2/2 по парам, остальные 6 дней из 7; плюс текущая и следующая неделя для экрана графика
  const shiftTimes: Record<string, [number, number]> = { WAITER: [10, 22], COOK: [9, 21], CASHIER: [9, 23], COURIER: [11, 22], CLEANER: [8, 16], MANAGER: [10, 19] };
  const shifts: { employeeId: number; startsAt: Date; endsAt: Date }[] = [];
  const attendance: { employeeId: number; checkIn: Date; checkOut: Date; lateMinutes: number }[] = [];
  for (let i = -DAYS; i < 14; i++) {
    const day = new Date(today);
    day.setDate(day.getDate() + i);
    employees.forEach((e, idx) => {
      const works = e.position === "WAITER" ? Math.floor((i + 100 + idx) / 2) % 2 === 0 || waiters.length < 3 : (i + 100 + idx) % 7 !== 0;
      if (!works) return;
      const [h1, h2] = shiftTimes[e.position] ?? [10, 20];
      const startsAt = at(day, h1);
      const endsAt = at(day, h2);
      shifts.push({ employeeId: e.id, startsAt, endsAt });
      if (i < 0) {
        const late = rnd() < 0.18 ? int(5, 25) : 0;
        const checkIn = new Date(startsAt.getTime() + (late ? late : -int(0, 10)) * 60000);
        const checkOut = new Date(endsAt.getTime() + int(-10, 25) * 60000);
        attendance.push({ employeeId: e.id, checkIn, checkOut, lateMinutes: late });
      }
    });
  }
  await db.shift.createMany({ data: shifts });
  await db.attendance.createMany({ data: attendance });

  // ---------- Продажи по дням ----------
  let number = ((await db.order.aggregate({ _max: { number: true } }))._max.number ?? 1000) + 1;
  let ordersTotal = 0;
  let revenue = 0;
  for (let i = DAYS; i >= 1; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    const weekend = day.getDay() === 5 || day.getDay() === 6 || day.getDay() === 0;
    const shift = await db.cashShift.create({ data: { openedById: cashier.id, openedAt: at(day, 9, 30), openingCash: 50000 } });
    const onDuty = waiters.filter((w) => shifts.some((s) => s.employeeId === w.id && s.startsAt.toDateString() === day.toDateString()));
    const count = int(weekend ? 38 : 24, weekend ? 52 : 36);
    let cashIn = 0;

    for (let k = 0; k < count; k++) {
      const type = pickW<string>([["DINE_IN", 70], ["TAKEAWAY", 20], ["DELIVERY", 10]]);
      // часы пик: обед и ужин
      const hour = pickW<number>([[11, 2], [12, 6], [13, 7], [14, 4], [15, 2], [16, 2], [17, 3], [18, 6], [19, 8], [20, 7], [21, 4], [22, 1]]);
      const openedAt = at(day, hour, int(0, 50));
      const paidAt = new Date(openedAt.getTime() + int(25, 70) * 60000);
      const lines = new Map<number, { dish: (typeof dishes)[number]; qty: number }>();
      const n = type === "DINE_IN" ? int(2, 6) : int(1, 4);
      for (let j = 0; j < n; j++) {
        const d = pickW(weighted);
        const cur = lines.get(d.id) ?? { dish: d, qty: 0 };
        cur.qty += d.nameRu.startsWith("Чай") && type === "DINE_IN" ? int(1, 2) : 1;
        lines.set(d.id, cur);
      }
      const subtotal = [...lines.values()].reduce((s, l) => s + l.qty * l.dish.price, 0);
      const discountAmount = rnd() < 0.06 ? Math.round(subtotal * 0.1) : 0;
      const serviceAmount = type === "DINE_IN" ? Math.round(((subtotal - discountAmount) * serviceBp) / 10000) : 0;
      const deliveryFee = type === "DELIVERY" ? 1000 : 0;
      const total = subtotal - discountAmount + serviceAmount + deliveryFee;
      const costTotal = [...lines.values()].reduce((s, l) => s + l.qty * cost(l.dish), 0);
      const method = pickW<string>([["CASH", 55], ["CARD", 25], ["TRANSFER", 15], ["QR", 5]]);
      if (method === "CASH") cashIn += total;

      const order = await db.order.create({
        data: {
          number: number++,
          type,
          status: "PAID",
          tableId: type === "DINE_IN" ? tables[int(0, tables.length - 1)].id : null,
          waiterId: type === "DINE_IN" && onDuty.length ? onDuty[int(0, onDuty.length - 1)].id : null,
          guests: type === "DINE_IN" ? int(1, 6) : null,
          discountType: discountAmount ? "PERCENT" : null,
          discountValue: discountAmount ? 1000 : 0,
          discountReason: discountAmount ? "Постоянный гость" : null,
          discountAmount,
          serviceChargeBp: type === "DINE_IN" ? serviceBp : 0,
          serviceAmount,
          deliveryFee,
          subtotal,
          total,
          costTotal,
          cashShiftId: shift.id,
          createdById: cashier.id,
          openedAt,
          paidAt,
          items: { create: [...lines.values()].map((l) => ({ dishId: l.dish.id, qty: l.qty, price: l.dish.price, costPrice: cost(l.dish), createdAt: openedAt })) },
          payments: {
            create: [
              {
                method,
                amount: total,
                received: method === "CASH" ? Math.ceil(total / 5000) * 5000 : null,
                provider: method === "TRANSFER" ? pickW([["Алиф", 3], ["Душанбе Сити", 2], ["Эсхата", 1]]) : null,
                createdAt: paidAt,
              },
            ],
          },
          ...(type === "DELIVERY"
            ? { delivery: { create: { customerName: pickW([["Шерзод", 1], ["Мавзуна", 1], ["Рустам", 1], ["Гулноза", 1], ["Сино", 1]]), phone: `+992 9${int(0, 3)} ${int(100, 999)} ${int(10, 99)} ${int(10, 99)}`, address: `ул. ${pickW([["Рудаки", 3], ["Айни", 2], ["Шотемур", 1], ["Исмоили Сомони", 2]])} ${int(1, 120)}`, fee: deliveryFee, courierId: courier?.id ?? null, status: "DELIVERED" } } }
            : {}),
        },
      });
      ordersTotal++;
      revenue += order.total;
    }

    // расход из кассы раз в несколько дней — зелень, лепёшки и т.п.
    let expenses = 0;
    if (rnd() < 0.4) {
      const amount = int(40, 180) * 100;
      expenses += amount;
      const op = await db.cashOperation.create({ data: { cashShiftId: shift.id, type: "EXPENSE", amount, category: "PURCHASE", comment: "Зелень и овощи с базара", createdById: cashier.id, createdAt: at(day, 12) } });
      await db.expense.create({ data: { category: "PURCHASE", amount, comment: op.comment, cashOperationId: op.id, date: at(day, 12), createdById: cashier.id } });
    }
    const expected = 50000 + cashIn - expenses;
    const diff = rnd() < 0.7 ? 0 : -int(1, 8) * 500;
    await db.cashShift.update({
      where: { id: shift.id },
      data: { closedAt: at(day, 23, 30), closedById: cashier.id, expectedCash: expected, actualCash: expected + diff, difference: diff },
    });
  }

  // ---------- Расходы ресторана ----------
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const fixed = [
    { category: "RENT", amount: 800000, comment: "Аренда помещения" },
    { category: "UTILITIES", amount: 145000, comment: "Свет, газ, вода" },
  ];
  for (const m of [prevMonthStart, monthStart]) {
    if (m < firstDay && m.getTime() !== monthStart.getTime()) continue;
    for (const f of fixed) await db.expense.create({ data: { ...f, date: at(m, 10) } });
  }
  // крупные закупки (мясо, рис) — раз в неделю, оплачены переводом, не из кассы
  for (let i = DAYS; i >= 1; i -= 7) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    await db.expense.create({ data: { category: "PURCHASE", amount: int(2800, 4200) * 100, comment: "Закупка: мясо, рис, масло", date: at(d, 9) } });
  }
  await db.expense.create({ data: { category: "OTHER", amount: 35000, comment: "Ремонт холодильника", date: at(new Date(today.getTime() - 9 * 86400000), 15) } });

  // авансы официантам в середине месяца
  const mid = new Date(today.getFullYear(), today.getMonth(), 15);
  if (mid < today) for (const w of waiters) await db.salaryAdjustment.create({ data: { employeeId: w.id, type: "ADVANCE", amount: 50000, comment: "Аванс", date: at(mid, 18) } });
  if (waiters[1]) await db.salaryAdjustment.create({ data: { employeeId: waiters[1].id, type: "FINE", amount: 10000, comment: "Опоздание", date: at(new Date(today.getTime() - 4 * 86400000), 12) } });

  // ---------- Брони впереди ----------
  const sat = new Date(today);
  sat.setDate(sat.getDate() + ((6 - sat.getDay() + 7) % 7 || 7));
  await db.reservation.create({ data: { startsAt: at(sat, 18), guests: 30, wholeHall: true, name: "Свадьба Каримовых", phone: "+992 90 555 44 33", prepayment: 0, comment: "Плов свадебный на всех, торт к 21:00" } });
  const tomorrow = new Date(today.getTime() + 86400000);
  const t6 = tables.find((t) => t.number === 6);
  await db.reservation.create({ data: { startsAt: at(tomorrow, 19, 30), guests: 6, tableId: t6?.id, name: "Фарида", phone: "+992 92 777 66 55", comment: "День рождения" } });

  console.log(`Демо-история: ${DAYS} дней, ${ordersTotal} заказов на ${(revenue / 100).toLocaleString("ru-RU")} TJS, ${attendance.length} отметок, ${shifts.length} смен в графике.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
