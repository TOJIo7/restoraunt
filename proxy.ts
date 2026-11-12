import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, cookieOptions, signSession, verifySession } from "./lib/session-token";

// Проверка входа до рендера + «скользящая» сессия:
// каждый запрос продлевает токен, без запросов он истекает (кассир — 15 минут).
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = pathname === "/login";

  if (!session && !isLogin) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (session && isLogin) {
    return NextResponse.redirect(new URL("/hall", req.url));
  }

  const res = NextResponse.next();
  // Продлеваем только на GET: POST — это server actions (например, выход),
  // они сами управляют cookie, и наше продление могло бы их перезаписать.
  if (session && req.method === "GET") {
    res.cookies.set(SESSION_COOKIE, await signSession(session), cookieOptions(session.role));
  }
  return res;
}

export const config = {
  // Всё, кроме статики Next и файлов из public
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|woff2?)$).*)"],
};
