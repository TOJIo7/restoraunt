"use client";

import { CircleCheck, Users, CalendarClock, Receipt } from "lucide-react";
import type { TableStatus } from "@/lib/constants";
import { useI18n } from "@/components/Providers";

// Статус всегда: цвет + иконка + слово (не только цвет)
const map: Record<TableStatus, { icon: typeof Users; cls: string }> = {
  FREE: { icon: CircleCheck, cls: "text-mint bg-mint/12 border-mint/30" },
  BUSY: { icon: Users, cls: "text-pomegranate bg-pomegranate/12 border-pomegranate/35" },
  RESERVED: { icon: CalendarClock, cls: "text-lapis bg-lapis/12 border-lapis/35" },
  BILL: { icon: Receipt, cls: "text-saffron bg-saffron/12 border-saffron/35" },
};

export function TableStatusBadge({ status }: { status: TableStatus }) {
  const { t } = useI18n();
  const { icon: Icon, cls } = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>
      <Icon size={14} strokeWidth={1.75} aria-hidden />
      {t.tableStatus[status]}
    </span>
  );
}
