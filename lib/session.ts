import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "./constants";
import { SESSION_COOKIE, cookieOptions, signSession, verifySession, type Session } from "./session-token";

export type { Session };

export async function createSession(s: Session) {
  (await cookies()).set(SESSION_COOKIE, await signSession(s), cookieOptions(s.role));
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession() {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Для страниц и действий: нет сессии → на вход; не та роль → в зал. */
export async function requireSession(roles?: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (roles && !roles.includes(s.role)) redirect("/hall");
  return s;
}
