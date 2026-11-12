import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  await requireSession(["OWNER"]);
  const [settings, users] = await Promise.all([
    db.setting.findUnique({ where: { id: 1 } }),
    db.user.findMany({ where: { active: true }, orderBy: { id: "asc" }, select: { id: true, name: true, role: true } }),
  ]);
  return (
    <SettingsClient
      settings={{
        restaurantName: settings?.restaurantName ?? "",
        serviceChargeBp: settings?.serviceChargeBp ?? 1000,
        soundEnabled: settings?.soundEnabled ?? true,
      }}
      users={users.map((u) => ({ ...u, role: u.role as "OWNER" | "CASHIER" }))}
    />
  );
}
