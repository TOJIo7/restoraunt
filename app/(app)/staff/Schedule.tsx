"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Copy, Trash2 } from "lucide-react";
import { useAction, useI18n, useToast } from "@/components/Providers";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { fmt } from "@/lib/i18n";
import { hhmm } from "@/lib/format";
import { copyPreviousWeek, deleteShift, saveShift } from "@/app/actions/staff";
import { Avatar, type Member } from "./Team";

export type ShiftRow = { employeeId: number; date: string; start: string; end: string };

const PRESETS: [string, string][] = [
  ["09:00", "17:00"],
  ["10:00", "22:00"],
  ["12:00", "23:00"],
  ["17:00", "01:00"],
];

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function Schedule({ team, weekStart, shifts, isOwner }: { team: Member[]; weekStart: string; shifts: ShiftRow[]; isOwner: boolean }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [pending, act] = useAction();
  const [edit, setEdit] = useState<{ m: Member; date: string; shift?: ShiftRow } | null>(null);
  const loc = locale === "tg" ? "tg-TJ" : "ru-RU";

  const start = new Date(`${weekStart}T12:00:00`);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
  const shift = (empId: number, date: string) => shifts.find((s) => s.employeeId === empId && s.date === date);
  const hours = (s: ShiftRow) => (new Date(s.end).getTime() - new Date(s.start).getTime()) / 3_600_000;
  const today = dayKey(new Date());
  const shiftWeek = (n: number) => {
    const d = new Date(start);
    d.setDate(d.getDate() + n * 7);
    return dayKey(d);
  };
  const dm = (d: Date) => d.toLocaleDateString(loc, { day: "numeric", month: "short" });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/staff?tab=schedule&week=${shiftWeek(-1)}`} className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-btn)] border border-line text-muted hover:text-text" aria-label="←">
          <ChevronLeft size={20} />
        </Link>
        <span className="num min-w-[200px] text-center font-display text-lg font-semibold">{fmt(t.staff.week, { from: dm(days[0]), to: dm(days[6]) })}</span>
        <Link href={`/staff?tab=schedule&week=${shiftWeek(1)}`} className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-btn)] border border-line text-muted hover:text-text" aria-label="→">
          <ChevronRight size={20} />
        </Link>
        <Link href="/staff?tab=schedule" className="ml-1 text-sm text-lapis hover:underline">
          {t.staff.thisWeek}
        </Link>
        {isOwner && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            disabled={pending}
            onClick={() => act(() => copyPreviousWeek(weekStart), { onOk: (d) => toast("ok", fmt(t.staff.copied, { n: d?.count ?? 0 })) })}
          >
            <Copy size={16} strokeWidth={1.75} />
            {t.staff.copyWeek}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
        <table className="w-full min-w-[900px] table-fixed text-sm">
          <thead className="bg-surface text-muted">
            <tr>
              <th className="w-56 px-4 py-3 text-left font-medium" />
              {days.map((d) => (
                <th key={d.toISOString()} className={`px-2 py-3 text-center font-medium capitalize ${dayKey(d) === today ? "text-saffron" : ""}`}>
                  <div>{d.toLocaleDateString(loc, { weekday: "short" })}</div>
                  <div className="num text-xs">{d.getDate()}</div>
                </th>
              ))}
              <th className="w-16 px-2 py-3 text-right font-medium">Σ</th>
            </tr>
          </thead>
          <tbody>
            {team.map((m) => {
              const total = days.reduce((s, d) => s + (shift(m.id, dayKey(d)) ? hours(shift(m.id, dayKey(d))!) : 0), 0);
              return (
                <tr key={m.id} className="border-t border-line">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.name} position={m.position} size={32} />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{m.name}</div>
                        <div className="text-xs text-muted">{t.positions[m.position as "WAITER"]}</div>
                      </div>
                    </div>
                  </td>
                  {days.map((d) => {
                    const key = dayKey(d);
                    const s = shift(m.id, key);
                    return (
                      <td key={key} className={`p-1.5 ${key === today ? "bg-saffron/5" : ""}`}>
                        <button
                          type="button"
                          disabled={!isOwner}
                          onClick={() => setEdit({ m, date: key, shift: s })}
                          className={`num flex h-12 w-full flex-col items-center justify-center rounded-lg text-xs transition-colors ${
                            s ? "border border-saffron/35 bg-saffron/12 font-semibold" : "border border-dashed border-line text-muted/50 enabled:hover:border-muted/60"
                          }`}
                        >
                          {s ? (
                            <>
                              <span>{hhmm(s.start)}</span>
                              <span className="text-muted">{hhmm(s.end)}</span>
                            </>
                          ) : (
                            "—"
                          )}
                        </button>
                      </td>
                    );
                  })}
                  <td className="num px-2 py-2 text-right font-semibold">{total ? fmt(t.staff.hoursWeek, { h: Math.round(total * 10) / 10 }) : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {edit && <ShiftModal edit={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function ShiftModal({ edit, onClose }: { edit: { m: Member; date: string; shift?: ShiftRow }; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [pending, act] = useAction();
  const [start, setStart] = useState(edit.shift ? hhmm(edit.shift.start) : "10:00");
  const [end, setEnd] = useState(edit.shift ? hhmm(edit.shift.end) : "22:00");
  const title = `${edit.m.name} · ${new Date(`${edit.date}T12:00:00`).toLocaleDateString(locale === "tg" ? "tg-TJ" : "ru-RU", { weekday: "long", day: "numeric", month: "long" })}`;
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      width={500}
      footer={
        <>
          {edit.shift && (
            <Button variant="ghost" className="mr-auto" disabled={pending} onClick={() => act(() => deleteShift(edit.m.id, edit.date), { onOk: onClose })}>
              <Trash2 size={18} strokeWidth={1.75} />
              {t.staff.dayOff}
            </Button>
          )}
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" disabled={pending} onClick={() => act(() => saveShift({ employeeId: edit.m.id, date: edit.date, start, end }), { onOk: onClose })}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex gap-4">
          <Input label={t.staff.start} type="time" value={start} step={900} onChange={(e) => setStart(e.target.value)} />
          <Input label={t.staff.end} type="time" value={end} step={900} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div>
          <div className="mb-2 text-sm text-muted">{t.staff.presets}</div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(([s, e]) => (
              <button
                key={s + e}
                type="button"
                onClick={() => {
                  setStart(s);
                  setEnd(e);
                }}
                className={`num h-11 rounded-[var(--radius-btn)] border px-3.5 text-sm transition-colors ${
                  start === s && end === e ? "border-saffron bg-saffron/12 text-saffron" : "border-line bg-surface-2 hover:border-muted/50"
                }`}
              >
                {s}–{e}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
