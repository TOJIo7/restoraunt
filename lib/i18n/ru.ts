const ru = {
  app: {
    name: "Роҳат",
    tagline: "Система ресторана",
  },
  nav: {
    hall: "Зал",
    orders: "Заказы",
    reservations: "Брони",
    cash: "Касса",
    menu: "Меню",
    stock: "Склад",
    staff: "Персонал",
    reports: "Отчёты",
    settings: "Настройки",
    about: "О проекте",
  },
  roles: {
    OWNER: "Владелец",
    CASHIER: "Кассир",
  },
  login: {
    title: "Вход",
    enterPin: "Введите пин-код",
    wrongPin: "Неверный пин-код",
    locked: "Слишком много попыток. Подождите {s} с",
    erase: "Стереть",
    clear: "Очистить",
    hint: "Демо: владелец 1111, кассир 2222",
  },
  common: {
    logout: "Выйти",
    language: "Язык",
    themeDark: "Тёмная тема",
    themeLight: "Светлая тема",
    save: "Сохранить",
    cancel: "Отмена",
    soon: "Скоро",
    stage: "Этап {n}",
    idleWarning: "Нет активности — выход через {s} с",
    stay: "Я здесь",
  },
  tableStatus: {
    FREE: "Свободен",
    BUSY: "Занят",
    RESERVED: "Бронь",
    BILL: "Ждёт оплаты",
  },
  placeholder: {
    hall: "Схема зала из 15 столов со статусами появится на этапе 1.",
    orders: "Заказы в зале, с собой и доставка появятся на этапе 2.",
    reservations: "Брони и банкеты с предоплатой появятся на этапе 4.",
    cash: "Кассовая смена, оплаты и чеки появятся на этапе 2.",
    menu: "Категории, блюда и стоп-лист появятся на этапе 1.",
    stock: "Продукты, техкарты и автосписание появятся на этапе 3.",
    staff: "Сотрудники, график и зарплата появятся на этапе 5.",
    reports: "Сводка дня, прибыль и графики появятся на этапе 6.",
    settings: "Название ресторана, плата за обслуживание, пин-коды.",
  },
};

export default ru;

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Dict = Widen<typeof ru>;
