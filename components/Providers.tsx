"use client";

import { createContext, useCallback, useContext, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { CircleCheck, CircleAlert } from "lucide-react";
import type { Dict, Locale } from "@/lib/i18n";
import type { ActionResult } from "@/lib/validate";

// ---------- Язык ----------

const I18nContext = createContext<{ locale: Locale; t: Dict } | null>(null);

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n вне Providers");
  return ctx;
}

// ---------- Уведомления ----------

type Toast = { id: number; kind: "ok" | "error"; text: string };
const ToastContext = createContext<(kind: Toast["kind"], text: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

/**
 * Вызов server action с уведомлением.
 * const [pending, act] = useAction();  act(() => saveDish(fd), { success: t.common.saved, onOk: close })
 */
export function useAction() {
  const { t } = useI18n();
  const toast = useToast();
  const [pending, start] = useTransition();
  const act = useCallback(
    <T,>(fn: () => Promise<ActionResult<T>>, opts: { success?: string; onOk?: (data?: T) => void } = {}) => {
      start(async () => {
        try {
          const res = await fn();
          if (res.ok) {
            if (opts.success) toast("ok", opts.success);
            opts.onOk?.(res.data);
          } else {
            toast("error", (t.errors as Record<string, string>)[res.error] ?? t.errors.generic);
          }
        } catch {
          toast("error", t.errors.generic);
        }
      });
    },
    [t, toast],
  );
  return [pending, act] as const;
}

// ---------- Провайдер ----------

export function Providers({ locale, t, children }: { locale: Locale; t: Dict; children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-2), { id, kind, text }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), kind === "error" ? 5000 : 2500);
  }, []);

  return (
    <I18nContext.Provider value={{ locale, t }}>
      <ToastContext.Provider value={push}>
        {/* reducedMotion="user": уважаем системную настройку «уменьшить движение» */}
        <MotionConfig reducedMotion="user">
          {children}
          <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-2" aria-live="polite">
            <AnimatePresence>
              {toasts.map((x) => (
                <motion.div
                  key={x.id}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ duration: 0.2 }}
                  className={`pointer-events-auto flex max-w-sm items-center gap-3 rounded-[var(--radius-card)] border bg-surface px-4 py-3 text-sm ${
                    x.kind === "ok" ? "border-mint/40" : "border-pomegranate/50"
                  }`}
                >
                  {x.kind === "ok" ? (
                    <CircleCheck size={18} strokeWidth={1.75} className="shrink-0 text-mint" />
                  ) : (
                    <CircleAlert size={18} strokeWidth={1.75} className="shrink-0 text-pomegranate" />
                  )}
                  {x.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </MotionConfig>
      </ToastContext.Provider>
    </I18nContext.Provider>
  );
}
