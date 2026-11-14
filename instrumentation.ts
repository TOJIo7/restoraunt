// Серверы Vercel работают по UTC. Касса считает время по местному (брони, смены, «сегодня»),
// поэтому на сервере выставляем время Душанбе. Локально TZ берётся из Windows и не трогается.
export function register() {
  if (process.env.VERCEL && !process.env.TZ) process.env.TZ = "Asia/Dushanbe";
}
