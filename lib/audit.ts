import { db } from "./db";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient | typeof db;

/** Записать действие в журнал: кто, что, над каким объектом. */
export async function audit(
  userId: number | null,
  action: string,
  entity: string,
  entityId?: string | number | null,
  details?: unknown,
  tx: Tx = db,
) {
  await tx.auditLog.create({
    data: {
      userId,
      action,
      entity,
      entityId: entityId == null ? null : String(entityId),
      details: details === undefined ? null : JSON.stringify(details),
    },
  });
}
