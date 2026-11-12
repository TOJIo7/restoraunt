import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { dishCost, marginPct } from "@/lib/stock";
import { MenuClient, type MenuCategory } from "./MenuClient";

export default async function MenuPage() {
  const session = await requireSession();
  const categories = await db.category.findMany({
    where: { active: true },
    orderBy: [{ sort: "asc" }, { id: "asc" }],
    include: {
      dishes: { where: { active: true }, orderBy: [{ sort: "asc" }, { id: "asc" }], include: { recipe: { include: { ingredient: true } } } },
    },
  });

  const data: MenuCategory[] = categories.map((c) => ({
    id: c.id,
    nameRu: c.nameRu,
    nameTg: c.nameTg,
    dishes: c.dishes.map((d) => ({
      id: d.id,
      categoryId: d.categoryId,
      nameRu: d.nameRu,
      nameTg: d.nameTg,
      descriptionRu: d.descriptionRu,
      descriptionTg: d.descriptionTg,
      price: d.price,
      photo: d.photo,
      inStopList: d.inStopList,
      autoStopped: d.autoStopped,
      // себестоимость и маржу видит только владелец
      cost: session.role === "OWNER" && d.recipe.length ? dishCost(d.recipe) : null,
      margin: session.role === "OWNER" && d.recipe.length ? marginPct(d.price, dishCost(d.recipe)) : null,
    })),
  }));

  return <MenuClient categories={data} canEdit={session.role === "OWNER"} />;
}
