import { getSession } from "@/lib/session";
import { getReport } from "@/lib/reports";
import { PERIODS, periodRange, ymd, addDays, type Period } from "@/lib/period";
import { buildXlsx, type Sheet } from "@/lib/xlsx";
import { audit } from "@/lib/audit";

const TJS = (d: number) => Math.round(d) / 100;
const PAY: Record<string, string> = { CASH: "Наличные", CARD: "Карта", TRANSFER: "Перевод", QR: "QR" };
const TYPE: Record<string, string> = { DINE_IN: "В зале", TAKEAWAY: "С собой", DELIVERY: "Доставка" };
const EXP: Record<string, string> = { RENT: "Аренда", UTILITIES: "Коммунальные", PURCHASE: "Закупка продуктов", SALARY: "Зарплата / аванс", OTHER: "Прочее" };

/** Отчёт за период в Excel: сводка, по дням, блюда, расходы, прибыль. Только владелец. */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "OWNER") return new Response("Forbidden", { status: 403 });
  const url = new URL(req.url);
  const period: Period = PERIODS.includes(url.searchParams.get("period") as Period) ? (url.searchParams.get("period") as Period) : "month";
  const { from, to } = periodRange(period, url.searchParams.get("from") ?? undefined, url.searchParams.get("to") ?? undefined);
  const r = await getReport(from, to);
  const range = `${ymd(from)} — ${ymd(addDays(to, -1))}`;

  const sheets: Sheet[] = [
    {
      name: "Сводка",
      widths: [32, 18],
      money: [1],
      rows: [
        ["Показатель", "Значение"],
        ["Период", range],
        ["Выручка, TJS", TJS(r.summary.revenue)],
        ["Заказов", r.summary.orders],
        ["Средний чек, TJS", TJS(r.summary.avg)],
        ["Себестоимость, TJS", TJS(r.summary.cost)],
        ["Валовая прибыль, TJS", TJS(r.summary.grossProfit)],
        ["Отменено заказов", r.summary.cancelled],
        [null, null],
        ["Способ оплаты", "Сумма, TJS"],
        ...Object.entries(r.summary.byMethod).map(([k, v]) => [PAY[k] ?? k, TJS(v)]),
        [null, null],
        ["Тип заказа", "Сумма, TJS"],
        ...Object.entries(r.summary.byType).map(([k, v]) => [TYPE[k] ?? k, TJS(v)]),
      ],
    },
    {
      name: r.oneDay ? "По часам" : "По дням",
      widths: [14, 16, 10],
      money: [1],
      rows: [[r.oneDay ? "Час" : "Дата", "Выручка, TJS", "Заказов"], ...r.series.map((x) => [r.oneDay ? `${x.key}:00` : x.key, TJS(x.revenue), x.orders])],
    },
    {
      name: "Блюда",
      widths: [28, 18, 10, 16, 18, 16, 10],
      money: [3, 4, 5],
      rows: [
        ["Блюдо", "Категория", "Продано", "Выручка, TJS", "Себестоимость, TJS", "Прибыль, TJS", "Маржа, %"],
        ...[...r.dishes].sort((a, b) => b.profit - a.profit).map((d) => [d.nameRu, d.categoryRu, d.qty, TJS(d.revenue), TJS(d.cost), TJS(d.profit), d.margin]),
      ],
    },
    {
      name: "Расходы",
      widths: [12, 22, 14, 40, 12],
      money: [2],
      rows: [
        ["Дата", "Категория", "Сумма, TJS", "Комментарий", "Из кассы"],
        ...r.expenses.list.map((e) => [e.date.slice(0, 10), EXP[e.category] ?? e.category, TJS(e.amount), e.comment ?? "", e.fromCash ? "да" : ""]),
      ],
    },
    {
      name: "Прибыль",
      widths: [44, 18],
      money: [1],
      rows: [
        ["Статья", "Сумма, TJS"],
        ["Выручка", TJS(r.profit.revenue)],
        ["− Себестоимость проданных блюд", TJS(r.profit.cost)],
        ["= Валовая прибыль", TJS(r.profit.grossProfit)],
        ["− Расходы (прочие + аренда и коммунальные за дни периода)", TJS(r.profit.expenses)],
        ["− Зарплата (начислено за период)", TJS(r.profit.salary)],
        ["= Прибыль", TJS(r.profit.profit)],
        [null, null],
        ["Справочно: закупки продуктов (уже в себестоимости)", TJS(r.profit.purchases)],
        ["Справочно: выдано зарплаты из кассы", TJS(r.profit.salaryPaid)],
      ],
    },
  ];

  await audit(s.uid, "REPORT_EXPORTED", "Report", null, { period, from: ymd(from), to: ymd(to) });
  const file = buildXlsx(sheets);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="report-${ymd(from)}_${ymd(addDays(to, -1))}.xlsx"`,
    },
  });
}
