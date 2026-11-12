"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, useAnimationControls } from "motion/react";
import { Delete } from "lucide-react";
import { login } from "@/app/actions/auth";
import { useI18n } from "@/components/Providers";
import { fmt } from "@/lib/i18n";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "erase"] as const;

export function PinPad() {
  const { t } = useI18n();
  const router = useRouter();
  const [pin, setPin] = useState("");
  const pinRef = useRef("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const shake = useAnimationControls();

  const submit = useCallback(
    (value: string) => {
      startTransition(async () => {
        const res = await login(value);
        if (res.ok) {
          router.replace("/hall");
          router.refresh();
          return;
        }
        pinRef.current = "";
        setPin("");
        setError(res.error === "locked" ? fmt(t.login.locked, { s: res.retryIn ?? 30 }) : t.login.wrongPin);
        shake.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.35 } });
      });
    },
    [router, shake, t],
  );

  const press = useCallback(
    (key: (typeof KEYS)[number]) => {
      if (pending) return;
      setError(null);
      const current = pinRef.current;
      let next = current;
      if (key === "clear") next = "";
      else if (key === "erase") next = current.slice(0, -1);
      else if (current.length < 4) next = current + key;
      pinRef.current = next;
      setPin(next);
      if (next.length === 4 && current.length === 3) submit(next);
    },
    [pending, submit],
  );

  // Ввод с физической клавиатуры
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key as (typeof KEYS)[number]);
      else if (e.key === "Backspace") press("erase");
      else if (e.key === "Escape") press("clear");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  return (
    <div className="w-full max-w-[340px]">
      <h1 className="font-display text-3xl font-semibold">{t.login.title}</h1>
      <p className="mt-2 text-muted">{t.login.enterPin}</p>

      <motion.div animate={shake} className="my-8 flex justify-center gap-4" aria-live="polite">
        {[0, 1, 2, 3].map((i) => (
          <motion.span
            key={i}
            className="h-4 w-4 rounded-full border-2"
            animate={{
              backgroundColor: i < pin.length ? "var(--saffron)" : "rgba(0,0,0,0)",
              borderColor: error ? "var(--pomegranate)" : i < pin.length ? "var(--saffron)" : "var(--line)",
              scale: i === pin.length - 1 ? [1, 1.25, 1] : 1,
            }}
            transition={{ duration: 0.18 }}
          />
        ))}
      </motion.div>

      <p className={`-mt-4 mb-4 h-5 text-center text-sm ${error ? "text-pomegranate" : "text-transparent"}`} role="alert">
        {error ?? "·"}
      </p>

      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            disabled={pending}
            onClick={() => press(k)}
            aria-label={k === "erase" ? t.login.erase : k === "clear" ? t.login.clear : k}
            className={`num flex h-16 items-center justify-center rounded-[var(--radius-btn)] border border-line transition-[transform,background-color] duration-150 active:scale-[0.97] disabled:opacity-50 ${
              k === "clear" || k === "erase"
                ? "bg-transparent text-sm text-muted hover:bg-surface-2"
                : "bg-surface font-display text-2xl font-medium hover:bg-surface-2"
            }`}
          >
            {k === "erase" ? <Delete size={22} strokeWidth={1.75} /> : k === "clear" ? t.login.clear : k}
          </button>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-muted/80">{t.login.hint}</p>
    </div>
  );
}
