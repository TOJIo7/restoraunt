import { PrismaClient } from "@prisma/client";
import { copyFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Демо на Vercel: файлы проекта там только для чтения, писать можно лишь в /tmp.
 * Копируем базу из проекта в /tmp и работаем с копией. Изменения живут, пока жив сервер,
 * и сбрасываются к исходным данным при его перезапуске — для показа этого достаточно.
 */
function demoDatabaseUrl(): string | undefined {
  if (!process.env.VERCEL) return undefined;
  const target = path.join(os.tmpdir(), "app.db");
  if (!existsSync(target)) copyFileSync(path.join(process.cwd(), "prisma", "dev.db"), target);
  // в настройках Vercel DATABASE_URL не задаём — выставляем здесь, чтобы Prisma не искала его
  process.env.DATABASE_URL = `file:${target}`;
  return process.env.DATABASE_URL;
}

// Один клиент на процесс (в dev Next перезагружает модули — держим его в globalThis).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const url = demoDatabaseUrl();
export const db = globalForPrisma.prisma ?? new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
