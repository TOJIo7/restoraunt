"use client";

import { useEffect, useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { useAction, useI18n, useToast } from "@/components/Providers";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { fmt } from "@/lib/i18n";
import { ddmm, hhmm } from "@/lib/format";
import { checkIn, checkOut } from "@/app/actions/staff";
import { Avatar, type Member } from "./Team";

export type AttendanceData = {
  todayShifts: { employeeId: number; start: string; end: string }[];
  open: { employeeId: number; checkIn: string; lateMinutes: number }[];
  log: { id: number; name: string; checkIn: string; checkOut: string | null; lateMinutes: number }[];
};

export function Attendance({ team, todayShifts, open, log }: { team: Member[] } & AttendanceData) {
  const { t } = useI18n();
  const toast = useToast();
  const [pending, act] = useAction();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // сначала те, кто по графику сегодня; потом остальные
  const sorted = [...team].sort((a, b) => Number(!todayShifts.some((s) => s.employeeId === a.id)) - Number(!todayShifts.some((s) => s.employeeId === b.id)));

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] content-start gap-3">
        {sorted.map((m) => {
          const shift = todayShifts.find((s) => s.employeeId === m.id);
          const att = open.find((a) => a.employeeId === m.id);
          const worked = att ? Math.round(((now - new Date(att.checkIn).getTime()) / 3_600_000) * 10) / 10 : 0;
          return (
            <Card key={m.id} className={`flex items-center gap-4 p-4 ${att ? "border-mint/40" : ""} ${!shift && !att ? "opacity-70" : ""}`}>
              <Avatar name={m.name} position={m.position} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{m.name}</div>
                <div className="num text-xs text-muted">
                  {shift ? fmt(t.staff.scheduled, { t: `${hhmm(shift.start)}–${hhmm(shift.end)}` }) : t.staff.notScheduled}
                </div>
                {att && (
                  <div className="num mt-1 flex flex-wrap gap-x-3 text-xs">
                    <span className="text-mint">{fmt(t.staff.onShift, { t: hhmm(att.checkIn) })}</span>
                    <span className="text-muted">{fmt(t.staff.workedHours, { h: worked })}</span>
                    {att.lateMinutes > 0 && <span className="text-apricot">{fmt(t.staff.late, { m: att.lateMinutes })}</span>}
                  </div>
                )}
              </div>
              {att ? (
                <Button size="sm" disabled={pending} onClick={() => act(() => checkOut(m.id), { onOk: (d) => toast("ok", `${m.name}: ${fmt(t.staff.workedHours, { h: d?.hours ?? 0 })}`) })}>
                  <LogOut size={16} strokeWidth={1.75} />
                  {t.staff.checkOut}
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    act(() => checkIn(m.id), {
                      onOk: (d) => toast(d?.lateMinutes ? "error" : "ok", `${m.name}: ${d?.lateMinutes ? fmt(t.staff.late, { m: d.lateMinutes }) : t.staff.onTime}`),
                    })
                  }
                >
                  <LogIn size={16} strokeWidth={1.75} />
                  {t.staff.checkIn}
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="p-5">
        <h3 className="mb-3 text-sm text-muted">{t.staff.log}</h3>
        {log.length === 0 ? (
          <p className="text-sm text-muted/80">{t.staff.noLog}</p>
        ) : (
          <ul className="num flex max-h-[520px] flex-col overflow-y-auto">
            {log.map((a) => {
              const h = a.checkOut ? Math.round(((new Date(a.checkOut).getTime() - new Date(a.checkIn).getTime()) / 3_600_000) * 10) / 10 : null;
              return (
                <li key={a.id} className="flex items-center gap-3 border-t border-line py-2.5 text-sm first:border-t-0">
                  <span className="w-12 text-muted">{ddmm(a.checkIn)}</span>
                  <span className="min-w-0 flex-1 truncate font-sans">{a.name}</span>
                  <span>
                    {hhmm(a.checkIn)}–{a.checkOut ? hhmm(a.checkOut) : "…"}
                  </span>
                  <span className="w-12 text-right text-muted">{h !== null ? fmt(t.staff.workedHours, { h }) : ""}</span>
                  <span className={`w-14 text-right text-xs ${a.lateMinutes ? "text-apricot" : "text-muted/40"}`}>{a.lateMinutes ? `+${a.lateMinutes}′` : "·"}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
