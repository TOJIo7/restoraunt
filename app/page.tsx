import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { SiteClient, type SiteCategory, type SiteFeatured } from "@/components/site/SiteClient";

export const metadata: Metadata = {
  title: "Чайхана «Роҳат» — плов, лагман, доставка по Душанбе",
  description: "Плов из казана и лепёшки из тандыра в центре Душанбе. Меню с ценами, бронь стола и доставка онлайн.",
};

// Сайт для гостей: открывается без входа. Меню и цены — живые, из той же базы, что и касса.
export default async function Home() {
  const { locale } = await getDict();
  const [settings, categories] = await Promise.all([
    db.setting.findUnique({ where: { id: 1 } }),
    db.category.findMany({
      where: { active: true },
      orderBy: { sort: "asc" },
      include: { dishes: { where: { active: true }, orderBy: { sort: "asc" } } },
    }),
  ]);

  const menu: SiteCategory[] = categories
    .filter((c) => c.dishes.length > 0)
    .map((c) => ({
      id: c.id,
      name: locale === "tg" ? c.nameTg || c.nameRu : c.nameRu,
      dishes: c.dishes.map((d) => ({
        id: d.id,
        name: locale === "tg" ? d.nameTg || d.nameRu : d.nameRu,
        description: (locale === "tg" ? d.descriptionTg : null) ?? d.descriptionRu,
        price: d.price,
        photo: d.photo,
        stopped: d.inStopList,
      })),
    }));

  // какие блюда показать крупно — по русскому названию (если блюдо убрали из меню, раздел просто возьмёт другое)
  const all = categories.flatMap((c) => c.dishes);
  const byName = (ru: string) => all.find((d) => d.nameRu === ru && d.photo);
  const featured: SiteFeatured = {
    hero: (byName("Плов") ?? all.find((d) => d.photo))?.id ?? null,
    signature: ["Плов свадебный", "Лагман", "Шашлык из баранины"].map((n) => byName(n)?.id).filter((x): x is number => !!x),
    about: ["Лепёшка", "Самбуса", "Чай зелёный", "Манты"].map((n) => byName(n)?.photo).filter((x): x is string => !!x),
    booking: byName("Курутоб")?.photo ?? byName("Плов свадебный")?.photo ?? null,
  };

  return <SiteClient restaurantName={settings?.restaurantName ?? "Чайхана «Роҳат»"} menu={menu} featured={featured} />;
}
