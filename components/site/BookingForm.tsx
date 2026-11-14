"use client";

import { useMemo, useState, useTransition } from "react";
import { motion } from "motion/react";
import { Check, Loader2, Minus, Plus } from "lucide-react";
import { useI18n } from "@/components/Providers";
import { fmt } from "@/lib/i18n";
import { SITE } from "@/lib/site";
import { submitSiteBooking } from "@/app/actions/site";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Слоты по 30 минут: с открытия до часа до закрытия; сегодня — не раньше чем через 30 минут. */
function slots(date: string) {
  const out: string[] = [];
  const now = new Date();
  const isToday = date === ymd(now);
  for (let m = SITE.openHour * 60; m <= (SITE.closeHour - 1) * 60; m += 30) {
    if (isToday && m < now.getHours() * 60 + now.getMinutes() + 30) continue;
    out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  }
  return out;
}

const inputCls = "h-12 w-full rounded-xl border border-line bg-bg px-4 text-[15px] outline-none transition-colors placeholder:text-muted/60 focus:border-saffron/60";

export function BookingForm() {
  const { t } = useI18n();
  const today = useMemo(() => new Date(), []);
  const firstDay = slots(ymd(today)).length ? ymd(today) : ymd(new Date(today.getTime() + 86_400_000));
  const lastDay = ymd(new Date(today.getTime() + SITE.bookDaysAhead * 86_400_000));
  const [date, setDate] = useState(firstDay);
  const times = slots(date);
  const [time, setTime] = useState(() => slots(firstDay).find((s) => s >= "19:00") ?? slots(firstDay)[0] ?? "");
  const [guests, setGuests] = useState(2);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+992 ");
  const [comment, setComment] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: number; phone: string } | null>(null);
  const [pending, start] = useTransition();

  const chosenTime = times.includes(time) ? time : (times[0] ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        const res = await submitSiteBooking({ date, time: chosenTime, guests, name, phone, comment, website });
        if (res.ok && res.data) setDone({ id: res.data.id, phone });
        else if (!res.ok) setError((t.errors as Record<string, string>)[res.error] ?? t.errors.generic);
      } catch {
        setError(t.errors.generic);
      }
    });
  };

  if (done) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 text-center">
        <motion.span
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-mint/15 text-mint"
        >
          <Check size={40} strokeWidth={2} />
        </motion.span>
        <h3 className="font-display text-2xl font-semibold">{fmt(t.site.booking.successTitle, { n: done.id })}</h3>
        <p className="max-w-xs text-muted">{fmt(t.site.booking.successText, { phone: done.phone })}</p>
        <button type="button" onClick={() => setDone(null)} className="mt-2 text-sm font-medium text-saffron hover:underline">
          {t.site.booking.again}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">{t.site.booking.date}</span>
        <input type="date" className={`${inputCls} num`} value={date} min={firstDay} max={lastDay} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">{t.site.booking.time}</span>
        <select className={`${inputCls} num`} value={chosenTime} onChange={(e) => setTime(e.target.value)} required>
          {times.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-sm text-muted">{t.site.booking.guests}</span>
        <div className="flex items-center gap-3">
          <div className="flex h-12 items-center rounded-xl border border-line bg-bg">
            <button type="button" onClick={() => setGuests((g) => Math.max(1, g - 1))} className="flex h-12 w-12 items-center justify-center text-muted hover:text-text" aria-label="−">
              <Minus size={16} strokeWidth={2} />
            </button>
            <span className="num w-10 text-center font-display text-lg font-semibold">{guests}</span>
            <button type="button" onClick={() => setGuests((g) => Math.min(SITE.maxGuests, g + 1))} className="flex h-12 w-12 items-center justify-center text-muted hover:text-text" aria-label="+">
              <Plus size={16} strokeWidth={2} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[2, 4, 6, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setGuests(n)}
                className={`num h-9 min-w-9 rounded-full border px-3 text-sm transition-colors ${guests === n ? "border-saffron/60 bg-saffron/10 text-saffron" : "border-line text-muted hover:text-text"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">{t.site.booking.name}</span>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">{t.site.booking.phone}</span>
        <input className={`${inputCls} num`} value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={30} inputMode="tel" autoComplete="tel" />
      </label>
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-sm text-muted">{t.site.booking.comment}</span>
        <input className={inputCls} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} placeholder={t.site.booking.commentPh} />
      </label>
      <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {error && (
        <p className="rounded-xl bg-pomegranate/12 px-3 py-2 text-sm text-pomegranate sm:col-span-2" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || !chosenTime}
        className="flex h-14 items-center justify-center gap-2 rounded-full bg-saffron font-semibold text-on-saffron shadow-[0_0_24px_var(--glow)] transition-[filter,transform] hover:brightness-110 active:scale-[0.98] disabled:opacity-40 sm:col-span-2"
      >
        {pending && <Loader2 size={18} className="animate-spin" />}
        {t.site.booking.submit}
      </button>
    </form>
  );
}
