"use client";

// Карта OpenStreetMap на Leaflet. Грузить через next/dynamic({ ssr: false }) — Leaflet работает только в браузере.
// Метки — свои (divIcon), без картинок Leaflet: те ломаются при сборке.

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type LatLng = { lat: number; lng: number };

const pin = (cls: string) =>
  L.divIcon({
    className: "",
    html: `<div class="map-pin ${cls}"><span></span></div>`,
    iconSize: [34, 44],
    iconAnchor: [17, 42],
  });

export default function LeafletMap({
  center,
  marker,
  home,
  draggable = false,
  onPick,
  zoom = 14,
  className = "h-72",
  radiusKm,
}: {
  center: LatLng;
  /** метка гостя (адрес доставки) */
  marker?: LatLng | null;
  /** метка ресторана */
  home?: LatLng;
  draggable?: boolean;
  /** гость передвинул метку или кликнул по карте */
  onPick?: (p: LatLng) => void;
  zoom?: number;
  className?: string;
  /** круг зоны доставки вокруг ресторана */
  radiusKm?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const guest = useRef<L.Marker | null>(null);
  const pickRef = useRef(onPick);
  useEffect(() => {
    pickRef.current = onPick;
  }, [onPick]);

  // создать карту один раз
  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { scrollWheelZoom: false, attributionControl: true }).setView([center.lat, center.lng], zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    if (home) L.marker([home.lat, home.lng], { icon: pin("map-pin--home"), keyboard: false }).addTo(m);
    if (home && radiusKm) L.circle([home.lat, home.lng], { radius: radiusKm * 1000, color: "#f2a93b", weight: 1, fillOpacity: 0.05 }).addTo(m);
    if (draggable) m.on("click", (e: L.LeafletMouseEvent) => pickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      guest.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- карта создаётся один раз, дальше двигаем её эффектами ниже
  }, []);

  // метка гостя следует за пропсом
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!marker) {
      guest.current?.remove();
      guest.current = null;
      return;
    }
    if (!guest.current) {
      guest.current = L.marker([marker.lat, marker.lng], { icon: pin("map-pin--guest"), draggable }).addTo(m);
      guest.current.on("dragend", () => {
        const p = guest.current!.getLatLng();
        pickRef.current?.({ lat: p.lat, lng: p.lng });
      });
    } else guest.current.setLatLng([marker.lat, marker.lng]);
    if (!m.getBounds().pad(-0.15).contains([marker.lat, marker.lng])) m.panTo([marker.lat, marker.lng]);
  }, [marker, draggable]);

  // сменился центр (например, нашли адрес) — плавно летим туда
  useEffect(() => {
    map.current?.flyTo([center.lat, center.lng], Math.max(map.current.getZoom(), zoom), { duration: 0.6 });
  }, [center.lat, center.lng, zoom]);

  return <div ref={box} className={`relative z-0 overflow-hidden rounded-[var(--radius-card)] border border-line ${className}`} />;
}
