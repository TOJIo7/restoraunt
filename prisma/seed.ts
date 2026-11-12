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

  // 15 столов на сетке 8×5 (ряды 1 и 3 — проходы); 15-й — длинный банкетный
  const layout: { number: number; seats: number; x: number; y: number; shape: string }[] = [
    { number: 1, seats: 2, x: 0, y: 0, shape: "round" },
    { number: 2, seats: 2, x: 1, y: 0, shape: "round" },
    { number: 3, seats: 4, x: 3, y: 0, shape: "square" },
    { number: 4, seats: 4, x: 4, y: 0, shape: "square" },
    { number: 5, seats: 4, x: 6, y: 0, shape: "square" },
    { number: 6, seats: 6, x: 7, y: 0, shape: "square" },
    { number: 7, seats: 4, x: 0, y: 2, shape: "square" },
    { number: 8, seats: 4, x: 1, y: 2, shape: "square" },
    { number: 9, seats: 4, x: 3, y: 2, shape: "round" },
    { number: 10, seats: 4, x: 4, y: 2, shape: "round" },
    { number: 11, seats: 6, x: 0, y: 4, shape: "square" },
    { number: 12, seats: 6, x: 1, y: 4, shape: "square" },
    { number: 13, seats: 2, x: 3, y: 4, shape: "round" },
    { number: 14, seats: 2, x: 4, y: 4, shape: "round" },
    { number: 15, seats: 12, x: 6, y: 2, shape: "long" },
  ];
  for (const t of layout) {
    await db.diningTable.upsert({ where: { number: t.number }, update: {}, create: t });
  }

  // ---------- Меню ----------
  // [название RU, название TJ, цена TJS, описание RU]
  type D = [string, string, number, string?];
  const menu: { ru: string; tg: string; dishes: D[] }[] = [
    {
      ru: "Горячие блюда",
      tg: "Таомҳои гарм",
      dishes: [
        ["Плов", "Оши палов", 35, "Рис девзира, баранина, жёлтая морковь, нут"],
        ["Плов свадебный", "Оши тӯй", 45, "С изюмом, айвой и перепелиным яйцом"],
        ["Лагман", "Лағмон", 32, "Тянутая лапша, говядина, овощи"],
        ["Манты", "Манту", 30, "5 штук, баранина с луком, на пару"],
        ["Курутоб", "Қурутоб", 40, "Фатир, курут, свежие овощи, зелень"],
        ["Каурдак", "Қовурдоқ", 42, "Жаркое из баранины с картофелем"],
        ["Димлама", "Димлама", 40, "Мясо и овощи, томлённые в казане"],
      ],
    },
    {
      ru: "Супы",
      tg: "Шӯрбоҳо",
      dishes: [
        ["Шурпо", "Шӯрбо", 30, "Бульон из баранины, картофель, морковь"],
        ["Угро", "Угро", 28, "Суп с домашней лапшой"],
        ["Мастова", "Мастова", 25, "Рисовый суп с катыком"],
        ["Чучвара", "Тушбера", 30, "Пельмени в бульоне"],
      ],
    },
    {
      ru: "Шашлык",
      tg: "Кабобҳо",
      dishes: [
        ["Шашлык из баранины", "Кабоби гӯсфанд", 25, "1 шампур"],
        ["Шашлык из говядины", "Кабоби гӯшти гов", 22, "1 шампур"],
        ["Шашлык из курицы", "Кабоби мурғ", 18, "1 шампур"],
        ["Люля-кебаб", "Люля-кабоб", 20, "1 шампур"],
        ["Жигар", "Ҷигар", 18, "Печень с курдюком, 1 шампур"],
      ],
    },
    {
      ru: "Салаты",
      tg: "Салатҳо",
      dishes: [
        ["Шакароб", "Шакароб", 25, "Помидоры, лук, катык, фатир"],
        ["Ачичук", "Аччиқ-чучук", 12, "Помидоры, лук, острый перец"],
        ["Оливье", "Оливе", 22],
        ["Овощная нарезка", "Сабзавоти буридашуда", 18],
      ],
    },
    {
      ru: "Выпечка",
      tg: "Самбӯса ва нон",
      dishes: [
        ["Самбуса", "Самбӯса", 8, "С бараниной и луком"],
        ["Самбуса тандырная", "Самбӯсаи тандирӣ", 10, "Большая, из тандыра"],
        ["Лепёшка", "Нони тандирӣ", 4],
        ["Фатир", "Фатир", 12, "Слоёная лепёшка на масле"],
      ],
    },
    {
      ru: "Напитки",
      tg: "Нӯшокиҳо",
      dishes: [
        ["Чай зелёный", "Чойи кабуд", 6, "Чайник"],
        ["Чай чёрный", "Чойи сиёҳ", 6, "Чайник"],
        ["Чай с лимоном", "Чой бо лиму", 8, "Чайник"],
        ["Компот", "Компот", 7, "Стакан"],
        ["Дуғ", "Дӯғ", 8, "Кисломолочный напиток"],
        ["Кола 0,5 л", "Кола 0,5 л", 10],
        ["Вода 0,5 л", "Об 0,5 л", 5],
      ],
    },
    {
      ru: "Десерты",
      tg: "Шириниҳо",
      dishes: [
        ["Чак-чак", "Чак-чак", 15],
        ["Халва", "Ҳалво", 12],
        ["Пахлава", "Пахлава", 15],
      ],
    },
  ];

  let dishCount = 0;
  for (const [ci, cat] of menu.entries()) {
    const category =
      (await db.category.findFirst({ where: { nameRu: cat.ru } })) ??
      (await db.category.create({ data: { nameRu: cat.ru, nameTg: cat.tg, sort: ci + 1 } }));
    for (const [di, [ru, tg, price, desc]] of cat.dishes.entries()) {
      const exists = await db.dish.findFirst({ where: { nameRu: ru } });
      if (!exists) {
        await db.dish.create({
          data: { categoryId: category.id, nameRu: ru, nameTg: tg, price: TJS(price), descriptionRu: desc ?? null, sort: di + 1 },
        });
      }
      dishCount++;
    }
  }

  console.log(`Сид готов: владелец 1111, кассир 2222, 8 сотрудников, 15 столов, меню из ${dishCount} блюд.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
