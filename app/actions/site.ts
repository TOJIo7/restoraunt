"use server";

// Действия сайта для гостей. Работают БЕЗ входа, поэтому:
// — всё проверяем на сервере (цены и блюда берём из базы, а не из браузера);
// — ограничиваем частоту заявок с одного адреса;
// — ловушка для ботов: скрытое поле «website» должно остаться пустым.
// Заявка не меняет ни заказы, ни склад — её подтверждает кассир (app/actions/requests.ts).

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { int, oneOf, optStr, phone, reqStr, run, ValidationError } from "@/lib/validate";
import { SITE, deliveryFeeFor, distanceKm } from "@/lib/site";

const hits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

async function rateLimit() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) throw new ValidationError("tooManyRequests");
  list.push(now);
  hits.set(ip, list);
}

function honeypot(v: unknown) {
  if (typeof v === "string" && v.trim()) throw new ValidationError("generic");
}

export type SiteOrderInput = {
  type: "DELIVERY" | "TAKEAWAY";
  name: string;
  phone: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  payMethod: "CASH" | "CARD";
  comment?: string;
  items: { dishId: number; qty: number }[];
  website?: string;
};

export async function submitSiteOrder(input: SiteOrderInput) {
  return run(async () => {
    honeypot(input.website);
    const type = oneOf(input.type, ["DELIVERY", "TAKEAWAY"] as const);
    const name = reqStr(input.name, 80);
    const tel = phone(input.phone);
    const payMethod = oneOf(input.payMethod, ["CASH", "CARD"] as const);
    const comment = optStr(input.comment, 300);

    if (!Array.isArray(input.items) || input.items.length === 0) throw new ValidationError("orderEmpty");
    if (input.items.length > 40) throw new ValidationError("badValue");
    const qty = new Map<number, number>();
    for (const it of input.items) {
      const id = int(it.dishId, { min: 1 });
      qty.set(id, (qty.get(id) ?? 0) + int(it.qty, { min: 1, max: 50 }));
    }
    const dishes = await db.dish.findMany({ where: { id: { in: [...qty.keys()] }, active: true } });
    if (dishes.length !== qty.size) throw new ValidationError("notFound");
    if (dishes.some((d) => d.inStopList)) throw new ValidationError("dishStopped");
    const subtotal = dishes.reduce((s, d) => s + d.price * (qty.get(d.id) ?? 0), 0);
    if (subtotal < SITE.minOrder) throw new ValidationError("minOrder");

    let address: string | null = null;
    let lat: number | null = null;
    let lng: number | null = null;
    if (type === "DELIVERY") {
      address = reqStr(input.address, 200);
      if (input.lat != null && input.lng != null) {
        lat = Number(input.lat);
        lng = Number(input.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new ValidationError("badValue");
        if (distanceKm(SITE.lat, SITE.lng, lat, lng) > SITE.deliveryRadiusKm) throw new ValidationError("outOfZone");
      }
    }

    await rateLimit();
    const total = subtotal + (type === "DELIVERY" ? deliveryFeeFor(subtotal) : 0);
    const r = await db.siteRequest.create({
      data: {
        kind: "ORDER",
        name,
        phone: tel,
        comment,
        orderType: type,
        address,
        lat,
        lng,
        payMethod,
        items: JSON.stringify([...qty].map(([dishId, q]) => ({ dishId, qty: q }))),
        total,
      },
    });
    revalidatePath("/requests");
    return { id: r.id, total };
  });
}

export type SiteBookingInput = {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  guests: number;
  name: string;
  phone: string;
  comment?: string;
  website?: string;
};

export async function submitSiteBooking(input: SiteBookingInput) {
  return run(async () => {
    honeypot(input.website);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.time)) throw new ValidationError("badDate");
    const startsAt = new Date(`${input.date}T${input.time}:00`);
    if (isNaN(startsAt.getTime())) throw new ValidationError("badDate");
    const now = Date.now();
    if (startsAt.getTime() < now + 30 * 60 * 1000) throw new ValidationError("reservationPast");
    if (startsAt.getTime() > now + SITE.bookDaysAhead * 24 * 3600 * 1000) throw new ValidationError("badDate");
    const minutes = startsAt.getHours() * 60 + startsAt.getMinutes();
    // последняя бронь — за час до закрытия
    if (minutes < SITE.openHour * 60 || minutes > (SITE.closeHour - 1) * 60) throw new ValidationError("outOfHours");

    const data = {
      kind: "BOOKING",
      startsAt,
      guests: int(input.guests, { min: 1, max: SITE.maxGuests }),
      name: reqStr(input.name, 80),
      phone: phone(input.phone),
      comment: optStr(input.comment, 300),
    };
    await rateLimit();
    const r = await db.siteRequest.create({ data });
    revalidatePath("/requests");
    return { id: r.id };
  });
}
