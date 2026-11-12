"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { createSession, destroySession, getSession } from "@/lib/session";
import type { Role } from "@/lib/constants";

// Защита от подбора: после 5 неверных попыток подряд — пауза 30 секунд.
// Касса одна, поэтому счётчик общий и хранится в памяти процесса.
const MAX_ATTEMPTS = 5;
const LOCK_MS = 30_000;
const guard = globalThis as unknown as { pinGuard?: { fails: number; lockedUntil: number } };
guard.pinGuard ??= { fails: 0, lockedUntil: 0 };

export type LoginResult = { ok: false; error: "wrong" | "locked"; retryIn?: number } | { ok: true };

export async function login(pin: string): Promise<LoginResult> {
  const g = guard.pinGuard!;
  const now = Date.now();
  if (g.lockedUntil > now) {
    return { ok: false, error: "locked", retryIn: Math.ceil((g.lockedUntil - now) / 1000) };
  }
  if (!/^\d{4}$/.test(pin)) return { ok: false, error: "wrong" };

  const users = await db.user.findMany({ where: { active: true } });
  let found: (typeof users)[number] | undefined;
  for (const u of users) {
    if (await bcrypt.compare(pin, u.pinHash)) {
      found = u;
      break;
    }
  }

  if (!found) {
    g.fails += 1;
    await audit(null, "LOGIN_FAILED", "User");
    if (g.fails >= MAX_ATTEMPTS) {
      g.fails = 0;
      g.lockedUntil = now + LOCK_MS;
      return { ok: false, error: "locked", retryIn: LOCK_MS / 1000 };
    }
    return { ok: false, error: "wrong" };
  }

  g.fails = 0;
  await createSession({ uid: found.id, role: found.role as Role, name: found.name });
  await audit(found.id, "LOGIN", "User", found.id);
  return { ok: true };
}

export async function logout(reason: "manual" | "idle" = "manual") {
  const s = await getSession();
  if (s) await audit(s.uid, reason === "idle" ? "LOGOUT_IDLE" : "LOGOUT", "User", s.uid);
  await destroySession();
  redirect("/login");
}
