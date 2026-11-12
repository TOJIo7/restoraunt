// Начальные данные этапа 0: настройки, сотрудники, вход по пин-коду, 15 столов.
// Меню, склад и продажи за месяц добавятся на следующих этапах.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const TJS = (n: number) => Math.round(n * 100);

async function main() {
  await db.setting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, restaurantName: "Чайхана «Роҳат»", serviceChargeBp: 1000 },
  });

  // 8 сотрудников: официанты с процентом от продаж, повара, кассир, курьер, уборщица
  const employees = [
    { name: "Фаррух Назаров", position: "MANAGER", phone: "+992 93 410 22 10", payType: "MONTHLY", salary: TJS(6000) },
    { name: "Мадина Каримова", position: "CASHIER", phone: "+992 92 731 05 44", payType: "MONTHLY", salary: TJS(3500) },
    { name: "Сухроб Рахимов", position: "WAITER", phone: "+992 90 118 76 03", payType: "MONTHLY", salary: TJS(2000), salesPercentBp: 500 },
    { name: "Дилшод Холов", position: "WAITER", phone: "+992 98 552 31 87", payType: "MONTHLY", salary: TJS(2000), salesPercentBp: 500 },
    { name: "Нигина Саидова", position: "WAITER", phone: "+992 93 207 64 19", payType: "PER_SHIFT", rate: TJS(120), salesPercentBp: 500 },
    { name: "Шамсиддин Одинаев", position: "COOK", phone: "+992 91 845 12 50", payType: "MONTHLY", salary: TJS(4500) },
    { name: "Бахтиёр Юсупов", position: "COURIER", phone: "+992 92 660 48 27", payType: "PER_SHIFT", rate: TJS(100) },
    { name: "Зарина Мирзоева", position: "CLEANER", phone: "+992 90 374 91 36", payType: "HOURLY", rate: TJS(15) },
  ] as const;

  const created: Record<string, number> = {};
  for (const e of employees) {
    const existing = await db.employee.findFirst({ where: { name: e.name } });
    const row = existing ?? (await db.employee.create({ data: { ...e } }));
    created[e.position + ":" + e.name] = row.id;
  }

  const ownerEmp = await db.employee.findFirstOrThrow({ where: { position: "MANAGER" } });
  const cashierEmp = await db.employee.findFirstOrThrow({ where: { position: "CASHIER" } });

  // Демо-пин-коды: владелец 1111, кассир 2222 (хранятся только хеши)
  const users = [
    { role: "OWNER", name: ownerEmp.name, pin: "1111", employeeId: ownerEmp.id },
    { role: "CASHIER", name: cashierEmp.name, pin: "2222", employeeId: cashierEmp.id },
  ];
  for (const u of users) {
    const pinHash = await bcrypt.hash(u.pin, 10);
    await db.user.upsert({
      where: { employeeId: u.employeeId },
      update: {},
      create: { role: u.role, name: u.name, pinHash, employeeId: u.employeeId },
    });
  }

  // 15 столов: позиции на сетке 6×4 для схемы зала; 15-й — длинный банкетный
  const layout: { number: number; seats: number; x: number; y: number; shape: string }[] = [
    { number: 1, seats: 2, x: 0, y: 0, shape: "round" },
    { number: 2, seats: 2, x: 1, y: 0, shape: "round" },
    { number: 3, seats: 4, x: 2, y: 0, shape: "square" },
    { number: 4, seats: 4, x: 3, y: 0, shape: "square" },
    { number: 5, seats: 4, x: 4, y: 0, shape: "square" },
    { number: 6, seats: 6, x: 5, y: 0, shape: "square" },
    { number: 7, seats: 4, x: 0, y: 1, shape: "square" },
    { number: 8, seats: 4, x: 1, y: 1, shape: "square" },
    { number: 9, seats: 4, x: 2, y: 1, shape: "round" },
    { number: 10, seats: 4, x: 3, y: 1, shape: "round" },
    { number: 11, seats: 6, x: 0, y: 2, shape: "square" },
    { number: 12, seats: 6, x: 1, y: 2, shape: "square" },
    { number: 13, seats: 2, x: 2, y: 2, shape: "round" },
    { number: 14, seats: 2, x: 3, y: 2, shape: "round" },
    { number: 15, seats: 12, x: 4, y: 2, shape: "long" },
  ];
  for (const t of layout) {
    await db.diningTable.upsert({ where: { number: t.number }, update: {}, create: t });
  }

  console.log("Сид готов: владелец 1111, кассир 2222, 8 сотрудников, 15 столов.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
