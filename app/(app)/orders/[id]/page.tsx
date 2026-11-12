import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getOpenShift } from "@/lib/cash";
import { getFreeTables, getOrderView, getPickerMenu, getSettings, getWaiters } from "@/lib/order-view";
import { OrderScreen } from "./OrderScreen";
import { PaidOrderView } from "./PaidOrderView";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const order = await getOrderView(id);
  if (!order) notFound();

  const settings = await getSettings();
  if (order.status === "PAID" || order.status === "CANCELLED") {
    return <PaidOrderView order={order} restaurantName={settings.restaurantName} isOwner={session.role === "OWNER"} />;
  }

  const [menu, waiters, freeTables, shift] = await Promise.all([getPickerMenu(), getWaiters(), getFreeTables(), getOpenShift()]);
  return (
    <OrderScreen
      order={order}
      menu={menu}
      waiters={waiters}
      freeTables={freeTables}
      hasShift={!!shift}
      isOwner={session.role === "OWNER"}
      settings={settings}
    />
  );
}
