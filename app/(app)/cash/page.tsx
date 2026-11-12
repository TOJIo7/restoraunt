import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getOpenShift, getShiftSummary } from "@/lib/cash";
import { CashClient } from "./CashClient";

export default async function CashPage() {
  const session = await requireSession();
  const isOwner = session.role === "OWNER";
  const shift = await getOpenShift();

  const [summary, operations, openOrders, openedBy, history] = await Promise.all([
    shift ? getShiftSummary(shift.id) : null,
    shift
      ? db.cashOperation.findMany({ where: { cashShiftId: shift.id }, orderBy: { id: "desc" }, include: { createdBy: { select: { name: true } } } })
      : [],
    db.order.count({ where: { status: { in: ["OPEN", "BILL"] } } }),
    shift ? db.user.findUnique({ where: { id: shift.openedById }, select: { name: true } }) : null,
    // разница в кассе по прошлым сменам — видит владелец
    isOwner
      ? db.cashShift.findMany({
          where: { closedAt: { not: null } },
          orderBy: { closedAt: "desc" },
          take: 10,
          include: { openedBy: { select: { name: true } }, closedBy: { select: { name: true } } },
        })
      : [],
  ]);

  return (
    <CashClient
      shift={
        shift && summary
          ? { id: shift.id, openedAt: shift.openedAt.toISOString(), openingCash: shift.openingCash, openedBy: openedBy?.name ?? "", summary }
          : null
      }
      operations={operations.map((o) => ({
        id: o.id,
        type: o.type,
        amount: o.amount,
        category: o.category,
        comment: o.comment,
        by: o.createdBy?.name ?? "",
        at: o.createdAt.toISOString(),
      }))}
      openOrders={openOrders}
      history={history.map((h) => ({
        id: h.id,
        openedAt: h.openedAt.toISOString(),
        closedAt: h.closedAt!.toISOString(),
        openedBy: h.openedBy.name,
        closedBy: h.closedBy?.name ?? "",
        expected: h.expectedCash ?? 0,
        actual: h.actualCash ?? 0,
        difference: h.difference ?? 0,
      }))}
      isOwner={isOwner}
    />
  );
}
