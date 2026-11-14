// Поиск адреса через Nominatim (OpenStreetMap). Бесплатно, без ключа.
// Правила сервиса: не чаще 1 запроса в секунду и без автодополнения — поэтому ищем по кнопке.

const BASE = "https://nominatim.openstreetmap.org";
// рамка вокруг Душанбе: запад, север, восток, юг
const VIEWBOX = "68.62,38.66,68.95,38.46";

let last = 0;
async function politeFetch(url: string) {
  const wait = Math.max(0, last + 1100 - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

type NominatimAddress = { road?: string; house_number?: string; neighbourhood?: string; suburb?: string; city?: string };

function shortAddress(a: NominatimAddress | undefined, fallback: string) {
  if (!a) return fallback;
  const street = [a.road, a.house_number].filter(Boolean).join(", ");
  const area = a.neighbourhood || a.suburb;
  return [street || area, street && area ? area : null].filter(Boolean).join(" · ") || fallback;
}

/** Адрес → точка на карте. null — не нашли. */
export async function geocode(query: string, lang: string) {
  const q = /душанбе|dushanbe/i.test(query) ? query : `${query}, Душанбе`;
  const url = `${BASE}/search?format=jsonv2&limit=1&addressdetails=1&countrycodes=tj&bounded=1&viewbox=${VIEWBOX}&accept-language=${lang}&q=${encodeURIComponent(q)}`;
  const list = (await politeFetch(url)) as { lat: string; lon: string; display_name: string; address?: NominatimAddress }[];
  const hit = list[0];
  if (!hit) return null;
  return { lat: Number(hit.lat), lng: Number(hit.lon), label: shortAddress(hit.address, hit.display_name) };
}

/** Точка на карте → короткий адрес (улица, дом · район). */
export async function reverseGeocode(lat: number, lng: number, lang: string) {
  const url = `${BASE}/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=${lang}&lat=${lat}&lon=${lng}`;
  const hit = (await politeFetch(url)) as { display_name?: string; address?: NominatimAddress; error?: string };
  if (hit.error || !hit.display_name) return null;
  return shortAddress(hit.address, hit.display_name);
}
