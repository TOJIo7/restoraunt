import { requireSession } from "@/lib/session";
import { getHall } from "@/lib/hall";
import { getOpenShift } from "@/lib/cash";
import { getFreeTables, getWaiters } from "@/lib/order-view";
import { HallClient } from "./HallClient";

export default async function HallPage() {
  const session = await requireSession();
  const [tables, waiters, freeTables, shift] = await Promise.all([getHall(), getWaiters(), getFreeTables(), getOpenShift()]);
  return <HallClient tables={tables} canEdit={session.role === "OWNER"} waiters={waiters} freeTables={freeTables} hasShift={!!shift} />;
}
