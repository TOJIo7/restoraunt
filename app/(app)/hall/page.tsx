import { requireSession } from "@/lib/session";
import { getHall } from "@/lib/hall";
import { getOpenShift } from "@/lib/cash";
import { getCouriers, getFreeTables, getWaiters } from "@/lib/order-view";
import { HallClient } from "./HallClient";

export default async function HallPage() {
  const session = await requireSession();
  const [tables, waiters, couriers, freeTables, shift] = await Promise.all([getHall(), getWaiters(), getCouriers(), getFreeTables(), getOpenShift()]);
  return (
    <HallClient tables={tables} canEdit={session.role === "OWNER"} waiters={waiters} couriers={couriers} freeTables={freeTables} hasShift={!!shift} />
  );
}
