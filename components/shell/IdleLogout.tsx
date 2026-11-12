"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { logout } from "@/app/actions/auth";
import { useI18n } from "@/components/Providers";
import { fmt } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";

const WARN_MS = 30_000; // за 30 секунд до выхода показываем предупреждение

/** Автовыход по бездействию (кассир — 15 минут). */
export function IdleLogout({ idleMs }: { idleMs: number }) {
  const { t } = useI18n();
  const last = useRef(0);
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    last.current = Date.now();
    const bump = () => {
      last.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    const timer = setInterval(() => {
      const remaining = idleMs - (Date.now() - last.current);
      if (remaining <= 0) {
        clearInterval(timer);
        void logout("idle");
      } else if (remaining <= WARN_MS) {
        setLeft(Math.ceil(remaining / 1000));
      } else {
        setLeft(null);
      }
    }, 1000);

    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [idleMs]);

  return (
    <AnimatePresence>
      {left !== null && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-[var(--radius-card)] border border-apricot/40 bg-surface px-5 py-3"
        >
          <span className="num text-sm">{fmt(t.common.idleWarning, { s: left })}</span>
          <Button size="sm" variant="secondary" onClick={() => setLeft(null)}>
            {t.common.stay}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
