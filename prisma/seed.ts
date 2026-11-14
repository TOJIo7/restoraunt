// Начальные данные этапа 0: настройки, сотрудники, вход по пин-коду, 15 столов.
// Меню, склад и продажи за месяц добавятся на следующих этапах.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { copyFile, mkdir, access } from "node:fs/promises";
import path from "node:path";

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

  // ---------- Фото блюд ----------
  // Исходники лежат в app/foodimg, копируются в uploads/ (оттуда их отдаёт /api/uploads).
  // Ставим только блюдам без фото — своё фото, загруженное владельцем, не трогаем.
  const photos: Record<string, string> = {
    Плов: "plov",
    "Плов свадебный": "plovsadebniy",
    Лагман: "lagman",
    Манты: "manti",
    Курутоб: "kururtob",
    Каурдак: "kaurdak",
    Димлама: "dimlama",
    Шурпо: "shurbo",
    Угро: "ugro",
    Мастова: "mastava",
    Чучвара: "chuchvara",
    "Шашлык из баранины": "shashlikbaranina",
    "Шашлык из говядины": "shashlikgovyadina",
    "Шашлык из курицы": "shashlikkuriniy",
    "Люля-кебаб": "lulyakebab",
    Жигар: "pechencgrudkoy",
    // ниже — с Wikimedia Commons, авторы и лицензии в app/foodimg/CREDITS.md
    Шакароб: "shakarob",
    Ачичук: "achichuk",
    Оливье: "olivier",
    "Овощная нарезка": "vegplate",
    Самбуса: "samsa",
    "Самбуса тандырная": "sambusa_tandir",
    Лепёшка: "lepeshka",
    Фатир: "fatir",
    "Чай зелёный": "tea_green",
    "Чай чёрный": "tea_black",
    "Чай с лимоном": "tea_lemon",
    Компот: "kompot",
    Дуғ: "dugh",
    "Кола 0,5 л": "cola0.5",
    "Вода 0,5 л": "voda",
    "Чак-чак": "chakchak",
    Халва: "halva",
    Пахлава: "baklava",
  };
  const srcDir = path.join(process.cwd(), "app", "foodimg");
  const uploadDir = path.join(process.cwd(), "uploads");
  await mkdir(uploadDir, { recursive: true });
  let photoCount = 0;
  for (const [ru, file] of Object.entries(photos)) {
    const dish = await db.dish.findFirst({ where: { nameRu: ru } });
    const src = path.join(srcDir, `${file}.jpg`);
    if (!dish || dish.photo || !(await access(src).then(() => true, () => false))) continue;
    // в имени для /api/uploads допустимы только буквы, цифры, _ и - (cola0.5 → cola0-5)
    const name = `menu-${file.replace(/[^\w-]/g, "-")}.jpg`;
    await copyFile(src, path.join(uploadDir, name));
    await db.dish.update({ where: { id: dish.id }, data: { photo: `/api/uploads/${name}` } });
    photoCount++;
  }
  if (photoCount) console.log(`Фото блюд: ${photoCount}`);

  // ---------- Склад ----------
  // [RU, TJ, единица, цена закупки TJS за единицу, остаток, минимум]
  const products: [string, string, string, number, number, number][] = [
    ["Рис девзира", "Биринҷи девзира", "KG", 14, 40, 10],
    ["Баранина", "Гӯшти гӯсфанд", "KG", 75, 25, 8],
    ["Говядина", "Гӯшти гов", "KG", 65, 20, 6],
    ["Курица", "Гӯшти мурғ", "KG", 32, 15, 5],
    ["Печень", "Ҷигар", "KG", 45, 5, 1.5],
    ["Курдюк", "Думба", "KG", 50, 5, 1],
    ["Морковь жёлтая", "Сабзии зард", "KG", 5, 30, 8],
    ["Лук репчатый", "Пиёз", "KG", 4, 25, 6],
    ["Картофель", "Картошка", "KG", 4, 30, 8],
    ["Помидоры", "Помидор", "KG", 10, 15, 5],
    ["Огурцы", "Бодиринг", "KG", 9, 10, 3],
    ["Зелень", "Сабзиҳои хушбӯй", "KG", 15, 4, 1],
    ["Перец острый", "Қаламфури тунд", "KG", 25, 2, 0.5],
    ["Нут", "Нахӯд", "KG", 16, 8, 2],
    ["Изюм", "Мавиз", "KG", 30, 4, 1],
    ["Мука", "Орд", "KG", 6, 50, 10],
    ["Масло хлопковое", "Равғани пахта", "L", 22, 20, 5],
    ["Катык", "Чакка", "L", 12, 10, 3],
    ["Курут", "Қурут", "KG", 40, 5, 1],
    ["Яйца", "Тухм", "PCS", 1.5, 120, 30],
    ["Сахар", "Шакар", "KG", 9, 20, 5],
    ["Чай зелёный", "Чойи кабуд", "KG", 120, 3, 0.5],
    ["Чай чёрный", "Чойи сиёҳ", "KG", 110, 3, 0.5],
    ["Лимон", "Лиму", "PCS", 3, 30, 10],
    ["Кола 0,5 л", "Кола 0,5 л", "PCS", 6, 48, 12],
    ["Вода 0,5 л", "Об 0,5 л", "PCS", 2.5, 48, 12],
  ];
  const ingId: Record<string, number> = {};
  for (const [ru, tg, unit, price, stock, min] of products) {
    let ing = await db.ingredient.findFirst({ where: { nameRu: ru } });
    if (!ing) {
      ing = await db.ingredient.create({ data: { nameRu: ru, nameTg: tg, unit, lastPrice: TJS(price), stock, minStock: min } });
      await db.stockMovement.create({ data: { ingredientId: ing.id, type: "INVENTORY", qty: stock, price: TJS(price), reason: "Начальный остаток" } });
    }
    ingId[ru] = ing.id;
  }

  // Техкарты: продукт → количество на одну порцию
  const recipes: Record<string, Record<string, number>> = {
    "Плов": { "Рис девзира": 0.15, "Баранина": 0.12, "Морковь жёлтая": 0.1, "Масло хлопковое": 0.03, "Лук репчатый": 0.03, "Нут": 0.02 },
    "Плов свадебный": { "Рис девзира": 0.15, "Баранина": 0.12, "Морковь жёлтая": 0.1, "Масло хлопковое": 0.03, "Лук репчатый": 0.03, "Изюм": 0.02, "Яйца": 1 },
    "Лагман": { "Мука": 0.12, "Говядина": 0.1, "Лук репчатый": 0.03, "Помидоры": 0.05, "Морковь жёлтая": 0.03, "Масло хлопковое": 0.02, "Перец острый": 0.005 },
    "Манты": { "Мука": 0.1, "Баранина": 0.12, "Лук репчатый": 0.08, "Курдюк": 0.02 },
    "Курутоб": { "Мука": 0.1, "Курут": 0.05, "Помидоры": 0.08, "Огурцы": 0.05, "Лук репчатый": 0.03, "Масло хлопковое": 0.03, "Зелень": 0.01 },
    "Каурдак": { "Баранина": 0.18, "Картофель": 0.2, "Лук репчатый": 0.05, "Масло хлопковое": 0.03 },
    "Димлама": { "Говядина": 0.15, "Картофель": 0.15, "Морковь жёлтая": 0.08, "Лук репчатый": 0.05, "Помидоры": 0.08 },
    "Шурпо": { "Баранина": 0.1, "Картофель": 0.12, "Морковь жёлтая": 0.05, "Лук репчатый": 0.03, "Помидоры": 0.05, "Нут": 0.02 },
    "Угро": { "Мука": 0.06, "Говядина": 0.06, "Лук репчатый": 0.02, "Помидоры": 0.03, "Морковь жёлтая": 0.02 },
    "Мастова": { "Рис девзира": 0.05, "Говядина": 0.05, "Катык": 0.05, "Морковь жёлтая": 0.02, "Лук репчатый": 0.02, "Помидоры": 0.03 },
    "Чучвара": { "Мука": 0.08, "Говядина": 0.08, "Лук репчатый": 0.03 },
    "Шашлык из баранины": { "Баранина": 0.15, "Лук репчатый": 0.03, "Курдюк": 0.02 },
    "Шашлык из говядины": { "Говядина": 0.15, "Лук репчатый": 0.03 },
    "Шашлык из курицы": { "Курица": 0.17, "Лук репчатый": 0.03 },
    "Люля-кебаб": { "Баранина": 0.12, "Курдюк": 0.03, "Лук репчатый": 0.04 },
    "Жигар": { "Печень": 0.12, "Курдюк": 0.03 },
    "Шакароб": { "Помидоры": 0.15, "Лук репчатый": 0.03, "Катык": 0.1, "Мука": 0.05, "Зелень": 0.01 },
    "Ачичук": { "Помидоры": 0.15, "Лук репчатый": 0.05, "Перец острый": 0.005 },
    "Оливье": { "Картофель": 0.08, "Морковь жёлтая": 0.03, "Яйца": 1, "Огурцы": 0.04, "Курица": 0.05 },
    "Овощная нарезка": { "Помидоры": 0.12, "Огурцы": 0.12, "Зелень": 0.02 },
    "Самбуса": { "Мука": 0.06, "Баранина": 0.05, "Лук репчатый": 0.04, "Курдюк": 0.01 },
    "Самбуса тандырная": { "Мука": 0.1, "Баранина": 0.08, "Лук репчатый": 0.05, "Курдюк": 0.02 },
    "Лепёшка": { "Мука": 0.25 },
    "Фатир": { "Мука": 0.15, "Масло хлопковое": 0.03 },
    "Чай зелёный": { "Чай зелёный": 0.008 },
    "Чай чёрный": { "Чай чёрный": 0.008 },
    "Чай с лимоном": { "Чай чёрный": 0.008, "Лимон": 0.25, "Сахар": 0.02 },
    "Компот": { "Сахар": 0.03, "Изюм": 0.02 },
    "Дуғ": { "Катык": 0.2 },
    "Кола 0,5 л": { "Кола 0,5 л": 1 },
    "Вода 0,5 л": { "Вода 0,5 л": 1 },
    "Чак-чак": { "Мука": 0.05, "Сахар": 0.04, "Яйца": 1, "Масло хлопковое": 0.03 },
    "Халва": { "Сахар": 0.05, "Мука": 0.05, "Масло хлопковое": 0.03 },
    "Пахлава": { "Мука": 0.06, "Сахар": 0.04, "Масло хлопковое": 0.03 },
  };
  let recipeCount = 0;
  for (const [dishName, parts] of Object.entries(recipes)) {
    const dish = await db.dish.findFirst({ where: { nameRu: dishName } });
    if (!dish) continue;
    if ((await db.recipeItem.count({ where: { dishId: dish.id } })) === 0) {
      await db.recipeItem.createMany({
        data: Object.entries(parts).map(([ing, qty]) => ({ dishId: dish.id, ingredientId: ingId[ing], qty })),
      });
    }
    recipeCount++;
  }

  const suppliers = [
    { name: "Бозори Шоҳмансур", phone: "+992 93 500 11 22" },
    { name: "Гӯшт-Сервис", phone: "+992 90 700 33 44" },
    { name: "Оби Зулол (напитки)", phone: "+992 92 800 55 66" },
  ];
  for (const sup of suppliers) {
    if (!(await db.supplier.findFirst({ where: { name: sup.name } }))) await db.supplier.create({ data: sup });
  }

  console.log(
    `Сид готов: владелец 1111, кассир 2222, 8 сотрудников, 15 столов, меню из ${dishCount} блюд, ${products.length} продуктов, ${recipeCount} техкарт.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
