import { requireSession } from "@/lib/session";
import { getHall } from "@/lib/hall";
import { HallClient } from "./HallClient";

export default async function HallPage() {
  const session = await requireSession();
  const tables = await getHall();
  return <HallClient tables={tables} canEdit={session.role === "OWNER"} />;
}
