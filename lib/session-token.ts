// Подпись и проверка токена сессии. Без next/headers — используется и в proxy.ts.
import { SignJWT, jwtVerify } from "jose";
import { CASHIER_IDLE_MS, OWNER_IDLE_MS, type Role } from "./constants";

export const SESSION_COOKIE = "session";

export type Session = { uid: number; role: Role; name: string };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET не задан");
  return new TextEncoder().encode(s ?? "dev-secret-change-me-dev-secret-change-me");
}

export function idleMsFor(role: Role) {
  return role === "OWNER" ? OWNER_IDLE_MS : CASHIER_IDLE_MS;
}

export function cookieOptions(role: Role) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(idleMsFor(role) / 1000),
  };
}

export async function signSession(s: Session) {
  return new SignJWT({ uid: s.uid, role: s.role, name: s.name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + idleMsFor(s.role)) / 1000))
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.uid !== "number" || (payload.role !== "OWNER" && payload.role !== "CASHIER")) return null;
    return { uid: payload.uid, role: payload.role, name: String(payload.name ?? "") };
  } catch {
    return null;
  }
}
