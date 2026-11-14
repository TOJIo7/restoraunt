import "server-only";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { ValidationError } from "./validate";

// Фото храним в ./uploads (не в public: public в проде отдаёт только файлы со сборки).
// Отдаёт их app/api/uploads/[file]/route.ts.
// На сервере папку можно вынести на постоянный диск через UPLOAD_DIR (см. scripts/start-prod.mjs).
// На Vercel (демо) писать можно только в /tmp; исходные фото читаются из папки проекта (BUNDLED_DIR).
export const BUNDLED_DIR = path.join(process.cwd(), "uploads");
export const UPLOAD_DIR = process.env.UPLOAD_DIR || (process.env.VERCEL ? path.join(os.tmpdir(), "uploads") : BUNDLED_DIR);
const ALLOWED: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 3 * 1024 * 1024;

export async function savePhoto(file: File): Promise<string> {
  const ext = ALLOWED[file.type];
  if (!ext) throw new ValidationError("badPhoto");
  if (file.size > MAX_BYTES) throw new ValidationError("photoTooBig");
  await mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return `/api/uploads/${name}`;
}

export async function removePhoto(url: string | null | undefined) {
  if (!url?.startsWith("/api/uploads/")) return;
  const name = path.basename(url);
  await unlink(path.join(UPLOAD_DIR, name)).catch(() => {});
}
