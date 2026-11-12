"use client";

import { CalendarClock, CircleCheck, Receipt, Users } from "lucide-react";
import { useI18n } from "@/components/Providers";
import { fmt } from "@/lib/i18n";
import type { TableStatus } from "@/lib/constants";
import type { HallTable } from "@/lib/hall";

export const STATUS_STYLE: Record<TableStatus, { icon: typeof Users; text: string; surface: string; chair: string }> = {
  FREE: { icon: CircleCheck, text: "text-mint", surface: "border-mint/45 bg-mint/10 hover:bg-mint/16", chair: "bg-mint/45" },
  BUSY: { icon: Users, text: "text-pomegranate", surface: "border-pomegranate/55 bg-pomegranate/14 hover:bg-pomegranate/20", chair: "bg-pomegranate/55" },
  RESERVED: { icon: CalendarClock, text: "text-lapis", surface: "border-lapis/55 bg-lapis/12 hover:bg-lapis/18", chair: "bg-lapis/50" },
  BILL: { icon: Receipt, text: "text-saffron", surface: "border-saffron/60 bg-saffron/14 hover:bg-saffron/20", chair: "bg-saffron/55" },
};

/** Позиции стульев вокруг стола, в процентах от размеров «столешницы». */
function chairs(shape: string, seats: number) {
  const n = Math.min(seats, shape === "long" ? 12 : 8);
  const out: { left: number; top: number; rot: number }[] = [];
  if (shape === "round") {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      out.push({ left: 50 + Math.cos(a) * 58, top: 50 + Math.sin(a) * 58, rot: (a * 180) / Math.PI + 90 });
    }
    return out;
  }
  // квадратный: стороны по кругу верх, низ, лево, право; банкетный — только верх и низ
  const sides = shape === "long" ? ["top", "bottom"] : ["top", "bottom", "left", "right"];
  const per: Record<string, number> = {};
  for (let i = 0; i < n; i++) per[sides[i % sides.length]] = (per[sides[i % sides.length]] ?? 0) + 1;
  for (const side of sides) {
    const c = per[side] ?? 0;
    for (let k = 0; k < c; k++) {
      const along = ((k + 1) / (c + 1)) * 100;
      if (side === "top") out.push({ left: along, top: -14, rot: 0 });
      if (side === "bottom") out.push({ left: along, top: 114, rot: 0 });
      if (side === "left") out.push({ left: -12, top: along, rot: 90 });
      if (side === "right") out.push({ left: 112, top: along, rot: 90 });
    }
  }
  return out;
}

export function TablePiece({ table, now, editing, onClick }: { table: HallTable; now: number; editing: boolean; onClick: () => void }) {
  const { t } = useI18n();
  const st = STATUS_STYLE[table.status];
  const Icon = st.icon;
  const minutes = table.since ? Math.max(0, Math.floor((now - new Date(table.since).getTime()) / 60000)) : null;
  const longWait = table.status === "BILL" && minutes !== null && minutes >= 10;
  const resTime = table.reservation
    ? new Date(table.reservation.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : null;

  // подпись всегда со словом статуса (цвет + иконка + слово)
  const caption =
    table.status === "BUSY" && minutes !== null
      ? fmt(t.hall.busyCaption, { m: minutes })
      : table.status === "RESERVED" && resTime
        ? fmt(t.hall.reservedCaption, { time: resTime })
        : t.tableStatus[table.status];

  const shapeCls =
    table.shape === "round" ? "aspect-square h-[58%] rounded-full" : table.shape === "long" ? "h-[54%] w-[84%] rounded-xl" : "aspect-square h-[56%] rounded-lg";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${fmt(t.hall.table, { n: table.number })} — ${t.tableStatus[table.status]}`}
      className="group flex h-full w-full flex-col items-center justify-center gap-[13%] rounded-2xl outline-offset-2"
    >
      <div
        className={`relative flex flex-col items-center justify-center border-2 transition-[background-color,border-color,transform] duration-300 group-hover:-translate-y-0.5 ${shapeCls} ${st.surface} ${
          editing ? "border-dashed" : ""
        }`}
      >
        {chairs(table.shape, table.seats).map((c, i) => (
          <span
            key={i}
            className={`absolute h-[7px] w-[16px] rounded-full transition-colors duration-300 ${st.chair}`}
            style={{ left: `${c.left}%`, top: `${c.top}%`, transform: `translate(-50%,-50%) rotate(${c.rot}deg)` }}
          />
        ))}
        {/* пульс у стола, который давно ждёт оплаты */}
        {longWait && <span className="absolute inset-[-6px] rounded-[inherit] border-2 border-saffron/60 motion-safe:animate-ping" />}
        <span className="num font-display text-[clamp(18px,2.2vw,28px)] font-semibold leading-none">{table.number}</span>
        <Icon size={15} strokeWidth={1.9} className={`mt-1 ${st.text}`} aria-hidden />
      </div>
      <span className={`num max-w-full truncate px-1 text-xs font-medium ${st.text}`}>{caption}</span>
    </button>
  );
}
