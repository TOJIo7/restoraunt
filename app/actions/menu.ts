"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/session";
import { removePhoto, savePhoto } from "@/lib/uploads";
import { int, money, optStr, reqStr, run, ValidationError } from "@/lib/validate";

// ---------- Категории (только владелец) ----------

export async function saveCategory(input: { id?: number; nameRu: string; nameTg: string }) {
  return run(async () => {
    const s = await requireSession(["OWNER"]);
    const data = { nameRu: reqStr(input.nameRu, 60), nameTg: reqStr(input.nameTg, 60) };
    if (input.id) {
      await db.category.update({ where: { id: int(input.id, { min: 1 }) }, data });
      await audit(s.uid, "CATEGORY_UPDATED", "Category", input.id, data);
    } else {
      const last = await db.category.aggregate({ _max: { sort: true } });
      const c = await db.category.create({ data: { ...data, sort: (last._max.sort ?? 0) + 1 } });
      await audit(s.uid, "CATEGORY_CREATED", "Category", c.id, data);
    }
    revalidatePath("/menu");
  });
}

export async function deleteCategory(id: number) {
  return run(async () => {
    const s = await requireSession(["OWNER"]);
    const activeDishes = await db.dish.count({ where: { categoryId: id, active: true } });
    if (activeDishes > 0) throw new ValidationError("categoryNotEmpty");
    // блюда в архиве могут ссылаться на категорию из старых заказов — поэтому скрываем, а не удаляем
    await db.category.update({ where: { id }, data: { active: false } });
    await audit(s.uid, "CATEGORY_ARCHIVED", "Category", id);
    revalidatePath("/menu");
  });
}

export async function moveCategory(id: number, dir: -1 | 1) {
  return run(async () => {
    await requireSession(["OWNER"]);
    const list = await db.category.findMany({ where: { active: true }, orderBy: [{ sort: "asc" }, { id: "asc" }] });
    const i = list.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await db.$transaction(list.map((c, k) => db.category.update({ where: { id: c.id }, data: { sort: k + 1 } })));
    revalidatePath("/menu");
  });
}

// ---------- Блюда ----------

/** Создать или изменить блюдо. FormData — потому что может прийти фото. */
export async function saveDish(form: FormData) {
  return run(async () => {
    const s = await requireSession(["OWNER"]);
    const id = form.get("id") ? int(form.get("id"), { min: 1 }) : null;
    const categoryId = int(form.get("categoryId"), { min: 1 });
    const data = {
      categoryId,
      nameRu: reqStr(form.get("nameRu"), 80),
      nameTg: reqStr(form.get("nameTg"), 80),
      descriptionRu: optStr(form.get("descriptionRu"), 300),
      descriptionTg: optStr(form.get("descriptionTg"), 300),
      price: money(form.get("price"), { min: 1 }),
      inStopList: form.get("inStopList") === "true",
    };
    if (!(await db.category.findFirst({ where: { id: categoryId, active: true } }))) throw new ValidationError("badValue");

    const photo = form.get("photo");
    const removeOld = form.get("removePhoto") === "true";
    const existing = id ? await db.dish.findUnique({ where: { id } }) : null;
    if (id && !existing) throw new ValidationError("notFound");

    let photoUrl = existing?.photo ?? null;
    if (photo instanceof File && photo.size > 0) {
      const newUrl = await savePhoto(photo);
      await removePhoto(photoUrl);
      photoUrl = newUrl;
    } else if (removeOld) {
      await removePhoto(photoUrl);
      photoUrl = null;
    }

    if (existing) {
      await db.dish.update({ where: { id: existing.id }, data: { ...data, photo: photoUrl } });
      // цену меняют редко и это важно — пишем старую и новую
      await audit(s.uid, "DISH_UPDATED", "Dish", existing.id, {
        name: data.nameRu,
        ...(existing.price !== data.price ? { priceFrom: existing.price, priceTo: data.price } : {}),
      });
    } else {
      const last = await db.dish.aggregate({ where: { categoryId }, _max: { sort: true } });
      const d = await db.dish.create({ data: { ...data, photo: photoUrl, sort: (last._max.sort ?? 0) + 1 } });
      await audit(s.uid, "DISH_CREATED", "Dish", d.id, { name: data.nameRu, price: data.price });
    }
    revalidatePath("/menu");
  });
}

/** Стоп-лист: может и кассир (кухня сказала «плов закончился»). */
export async function setStopList(dishId: number, inStopList: boolean) {
  return run(async () => {
    const s = await requireSession();
    const d = await db.dish.update({ where: { id: int(dishId, { min: 1 }) }, data: { inStopList: !!inStopList } });
    await audit(s.uid, inStopList ? "DISH_STOPPED" : "DISH_RESUMED", "Dish", d.id, { name: d.nameRu });
    revalidatePath("/menu");
  });
}

/** Убрать блюдо из меню. Не удаляем: на него ссылаются старые заказы и отчёты. */
export async function archiveDish(dishId: number) {
  return run(async () => {
    const s = await requireSession(["OWNER"]);
    const d = await db.dish.update({ where: { id: int(dishId, { min: 1 }) }, data: { active: false } });
    await audit(s.uid, "DISH_ARCHIVED", "Dish", d.id, { name: d.nameRu });
    revalidatePath("/menu");
  });
}
