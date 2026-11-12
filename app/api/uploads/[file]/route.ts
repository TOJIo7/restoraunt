import { readFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/uploads";

const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  // только имя файла, без путей — защита от ../
  if (!/^[\w-]+\.(jpg|png|webp)$/.test(file)) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(path.join(UPLOAD_DIR, file));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPES[path.extname(file)],
        "Cache-Control": "public, max-age=31536000, immutable", // имя уникальное — можно кэшировать навсегда
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
