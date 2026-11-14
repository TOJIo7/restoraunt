// Запуск на сервере (Railway и т.п.).
// Если задан DATA_DIR (постоянный диск), база и фото живут там и переживают перезапуски и новые деплои.
// При первом запуске туда копируется база и фото из проекта.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync, spawn } from "node:child_process";

const root = process.cwd();
const dataDir = process.env.DATA_DIR;

if (dataDir) {
  mkdirSync(dataDir, { recursive: true });

  const db = path.join(dataDir, "app.db");
  if (!existsSync(db)) {
    copyFileSync(path.join(root, "prisma", "dev.db"), db);
    console.log(`[start] база скопирована в ${db}`);
  }
  process.env.DATABASE_URL = `file:${db}`;

  const uploads = path.join(dataDir, "uploads");
  mkdirSync(uploads, { recursive: true });
  const src = path.join(root, "uploads");
  if (existsSync(src)) {
    for (const f of readdirSync(src)) {
      const to = path.join(uploads, f);
      if (!existsSync(to)) copyFileSync(path.join(src, f), to);
    }
  }
  process.env.UPLOAD_DIR = uploads;
}

const bin = (name) => path.join(root, "node_modules", ".bin", process.platform === "win32" ? `${name}.cmd` : name);

// новые миграции из кода применяются к базе на диске, данные не трогаются
const migrate = spawnSync(bin("prisma"), ["migrate", "deploy"], { stdio: "inherit", env: process.env, shell: process.platform === "win32" });
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

const port = process.env.PORT || "3000";
const app = spawn(bin("next"), ["start", "-p", port, "-H", "0.0.0.0"], { stdio: "inherit", env: process.env, shell: process.platform === "win32" });
app.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => app.kill(sig));
