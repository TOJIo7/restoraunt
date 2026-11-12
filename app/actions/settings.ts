"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireSession } from "@/lib/session";
import { int, reqStr, run, ValidationError } from "@/lib/validate";

export async function saveSettings(input: { restaurantName: string; servicePercent: string; soundEnabled: boolean }) {
  return run(async () => {
    const s = await requireSession(["OWNER"]);
    const pct = String(input.servicePercent ?? "").replace(",", ".").trim();
    if (!/^\d{1,2}(\.\d{1,2})?$/.test(pct)) throw new ValidationError("badPercent");
    const serviceChargeBp = Math.round(parseFloat(pct) * 100);
    if (serviceChargeBp > 3000) throw new ValidationError("badPercent"); // больше 30% — явно ошибка

    const before = await db.setting.findUnique({ where: { id: 1 } });
    const data = { restaurantName: reqStr(input.restaurantName, 80), serviceChargeBp, soundEnabled: !!input.soundEnabled };
    await db.setting.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
    await audit(s.uid, "SETTINGS_UPDATED", "Setting", 1, { ...data, serviceChargeBpFrom: before?.serviceChargeBp });
    revalidatePath("/", "layout");
  });
}

/** Владелец меняет пин-код себе или кассиру. Пин-коды не должны совпадать — по ним определяется роль. */
export async function changePin(userId: number, pin: string) {
  return run(async () => {
    const s = await requireSession(["OWNER"]);
    if (!/^\d{4}$/.test(pin)) throw new ValidationError("pinFormat");
    const users = await db.user.findMany({ where: { active: true } });
    const target = users.find((u) => u.id === int(userId, { min: 1 }));
    if (!target) throw new ValidationError("notFound");
    for (const u of users) {
      if (u.id !== target.id && (await bcrypt.compare(pin, u.pinHash))) throw new ValidationError("pinTaken");
    }
    await db.user.update({ where: { id: target.id }, data: { pinHash: await bcrypt.hash(pin, 10) } });
    await audit(s.uid, "PIN_CHANGED", "User", target.id, { role: target.role });
  });
}
