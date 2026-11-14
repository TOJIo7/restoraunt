// Данные ресторана для сайта гостей. Учебный проект: адрес и телефон вымышленные.

export const SITE = {
  phone: "+992 93 555 12 34",
  phoneHref: "tel:+992935551234",
  address: { ru: "Душанбе, проспект Рудаки, 84", tg: "Душанбе, хиёбони Рӯдакӣ, 84" },
  /** точка ресторана на карте (центр Душанбе) */
  lat: 38.5762,
  lng: 68.7838,
  /** часы работы, местное время */
  openHour: 9,
  closeHour: 23,
  /** доставка */
  deliveryFee: 1500, // дирамы = 15 TJS
  freeDeliveryFrom: 25000, // 250 TJS
  minOrder: 5000, // 50 TJS
  deliveryRadiusKm: 12,
  /** бронь онлайн: максимум гостей и сколько дней вперёд */
  maxGuests: 40,
  bookDaysAhead: 30,
} as const;

/** Расстояние между точками, км (формула гаверсинуса). */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function deliveryFeeFor(subtotal: number) {
  return subtotal >= SITE.freeDeliveryFrom ? 0 : SITE.deliveryFee;
}
