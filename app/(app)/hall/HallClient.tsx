"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check, LayoutDashboard, Plus, ShoppingBag } from "lucide-react";
import { useAction, useI18n, useToast } from "@/components/Providers";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/shell/PageHeader";
import { fmt } from "@/lib/i18n";
import { HALL_COLS, HALL_ROWS, TABLE_STATUSES, tableSpan } from "@/lib/constants";
import { saveLayout } from "@/app/actions/hall";
import type { HallTable } from "@/lib/hall";
import { STATUS_STYLE, TablePiece, tableCaption } from "./TablePiece";
import dynamic from "next/dynamic";
import { use3DSupport } from "@/components/three/support";

// 3D грузится отдельным файлом и только когда включили — касса открывается мгновенно
const Hall3D = dynamic(() => import("@/components/three/Hall3D"), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full rounded-[var(--radius-card)]" />,
});
const VIEW_KEY = "hall-view";
const readView = (): "2d" | "3d" => {
  try {
    return localStorage.getItem(VIEW_KEY) === "3d" ? "3d" : "2d";
  } catch {
    return "2d";
  }
};
const subscribeView = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};
import { NewOrderModal, type FreeTable, type HallReservation, type Waiter } from "@/components/orders/NewOrderModal";
import { NoShiftBanner } from "@/components/orders/NoShiftBanner";
import { TableForm } from "./TableForm";

type Pos = { x: number; y: number };

export function HallClient({
  tables,
  canEdit,
  waiters,
  couriers,
  freeTables,
  hasShift,
}: {
  tables: HallTable[];
  canEdit: boolean;
  waiters: Waiter[];
  couriers: Waiter[];
  freeTables: FreeTable[];
  hasShift: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [layout, setLayout] = useState<Record<number, Pos>>({});
  const [nonce, setNonce] = useState(0); // сбросить перетаскивание, если клетка занята
  // новый заказ: за столом (tableId) или «с собой» (null)
  const [newOrder, setNewOrder] = useState<{ tableId: number | null; reservation?: HallReservation | null } | null>(null);
  const [form, setForm] = useState<{ open: boolean; table?: HallTable }>({ open: false });
  const [pending, act] = useAction();
  const planRef = useRef<HTMLDivElement>(null);
  const justDragged = useRef(false); // после перетаскивания браузер шлёт click — его не считаем

  // «занят 25 мин» — тикает раз в 30 секунд
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // 2D / 3D: на кассе по умолчанию 2D, выбор запоминается в браузере
  const support3D = use3DSupport();
  const stored = useSyncExternalStore(subscribeView, readView, () => "2d" as const);
  const [picked, setPicked] = useState<"2d" | "3d" | null>(null);
  const view = picked ?? stored;
  const changeView = (v: "2d" | "3d") => {
    setPicked(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };
  const show3D = view === "3d" && support3D === true && !editing;

  const openTable = (tb: HallTable) => {
    // занятый стол — сразу в его заказ; свободный — открыть новый
    if (tb.orderId) return router.push(`/orders/${tb.orderId}`);
    if (!hasShift) return toast("error", t.errors.noShift);
    setNewOrder({ tableId: tb.id, reservation: tb.reservation });
  };

  const placed = useMemo(() => tables.map((tb) => ({ ...tb, ...(layout[tb.id] ?? {}) })), [tables, layout]);
  const counts = Object.fromEntries(TABLE_STATUSES.map((s) => [s, tables.filter((x) => x.status === s).length]));
  const dirty = Object.keys(layout).length > 0;

  /** Отпустили стол: ближайшая клетка, если свободна — ставим, иначе возвращаем назад. */
  const onDrop = (table: HallTable, el: HTMLElement) => {
    const plan = planRef.current;
    if (!plan) return;
    const pr = plan.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const cw = pr.width / HALL_COLS;
    const ch = pr.height / HALL_ROWS;
    const span = tableSpan(table.shape);
    const x = Math.min(Math.max(Math.round((er.left - pr.left) / cw), 0), HALL_COLS - span);
    const y = Math.min(Math.max(Math.round((er.top - pr.top) / ch), 0), HALL_ROWS - 1);
    const taken = placed.some(
      (o) => o.id !== table.id && o.y === y && x < o.x + tableSpan(o.shape) && o.x < x + span,
    );
    if (!taken) setLayout((l) => ({ ...l, [table.id]: { x, y } }));
    setNonce((n) => n + 1);
  };

  const finishEditing = () => {
    if (!dirty) return setEditing(false);
    act(() => saveLayout(placed.map(({ id, x, y }) => ({ id, x, y }))), {
      success: t.hall.layoutSaved,
      onOk: () => {
        setLayout({});
        setEditing(false);
      },
    });
  };

  return (
    <>
      <PageHeader
        title={t.nav.hall}
        subtitle={fmt(t.hall.subtitle, { free: counts.FREE, total: tables.length })}
        actions={
          editing ? (
            <>
              <Button onClick={() => setForm({ open: true })}>
                <Plus size={18} strokeWidth={1.75} />
                {t.hall.addTable}
              </Button>
              <Button variant="primary" onClick={finishEditing} disabled={pending}>
                <Check size={18} strokeWidth={2} />
                {t.common.done}
              </Button>
            </>
          ) : (
            <>
              {canEdit && (
                <Button variant="ghost" onClick={() => setEditing(true)}>
                  <LayoutDashboard size={18} strokeWidth={1.75} />
                  {t.hall.editLayout}
                </Button>
              )}
              <Button onClick={() => setNewOrder({ tableId: null })} disabled={!hasShift}>
                <ShoppingBag size={18} strokeWidth={1.75} />
                {t.orderType.TAKEAWAY}
              </Button>
            </>
          )
        }
      />

      {!hasShift && !editing && <NoShiftBanner />}

      {/* Легенда: цвет + иконка + слово + сколько */}
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        {TABLE_STATUSES.map((s) => {
          const { icon: Icon, text } = STATUS_STYLE[s];
          return (
            <span key={s} className="inline-flex items-center gap-2 text-sm">
              <Icon size={16} strokeWidth={1.75} className={text} />
              <span className="text-muted">{t.tableStatus[s]}</span>
              <span className="num font-semibold">{counts[s]}</span>
            </span>
          );
        })}
        {editing && <span className="ml-auto text-sm text-saffron">{t.hall.dragHint}</span>}
        {!editing && support3D && (
          <div className="ml-auto flex items-center gap-3">
            {show3D && <span className="hidden text-xs text-muted xl:inline">{t.hall.rotateHint}</span>}
            <div className="flex rounded-[var(--radius-btn)] border border-line bg-surface p-1" role="group" aria-label={t.hall.view}>
              {(["2d", "3d"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => changeView(v)}
                  aria-pressed={view === v}
                  className={`relative h-8 rounded-lg px-3 text-xs font-semibold transition-colors ${view === v ? "text-saffron" : "text-muted hover:text-text"}`}
                >
                  {view === v && <motion.span layoutId="hall-view" className="absolute inset-0 rounded-lg bg-saffron/15" />}
                  <span className="relative">{v.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {show3D ? (
        <div className="relative h-[max(440px,calc(100vh-300px))] overflow-hidden rounded-[var(--radius-card)] border border-line">
          <Hall3D
            tables={tables.map((tb) => {
              const { caption, longWait } = tableCaption(tb, now, t);
              return { ...tb, caption, pulse: longWait };
            })}
            onPick={(p) => {
              const tb = tables.find((x) => x.id === p.id);
              if (tb) openTable(tb);
            }}
            labels={{ kitchen: t.hall.kitchen, cash: t.hall.cashDesk, entrance: t.hall.entrance }}
            onSlow={() => {
              changeView("2d");
              toast("error", t.hall.slow3d);
            }}
          />
        </div>
      ) : (
      /* План зала */
      <div className="relative rounded-[var(--radius-card)] border border-line bg-surface p-5 pb-7">
        <FloorLabel className="right-10 top-0 -translate-y-1/2">{t.hall.kitchen}</FloorLabel>
        <FloorLabel className="left-10 top-0 -translate-y-1/2">{t.hall.cashDesk}</FloorLabel>
        <FloorLabel className="bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2" door>
          {t.hall.entrance}
        </FloorLabel>

        <div ref={planRef} className="relative h-[max(400px,calc(100vh-340px))] w-full">
          {/* сетка видна только при расстановке */}
          {editing && (
            <div
              className="pointer-events-none absolute inset-0 grid"
              style={{ gridTemplateColumns: `repeat(${HALL_COLS}, 1fr)`, gridTemplateRows: `repeat(${HALL_ROWS}, 1fr)` }}
            >
              {Array.from({ length: HALL_COLS * HALL_ROWS }, (_, i) => (
                <div key={i} className="m-1 rounded-xl border border-dashed border-line/80" />
              ))}
            </div>
          )}

          {placed.map((tb) => (
            <motion.div
              key={`${tb.id}-${tb.x}-${tb.y}-${editing ? nonce : 0}`}
              className={`absolute p-1 ${editing ? "z-10 cursor-grab active:z-20 active:cursor-grabbing" : ""}`}
              style={{
                left: `${(tb.x / HALL_COLS) * 100}%`,
                top: `${(tb.y / HALL_ROWS) * 100}%`,
                width: `${(tableSpan(tb.shape) / HALL_COLS) * 100}%`,
                height: `${100 / HALL_ROWS}%`,
              }}
              drag={editing}
              dragMomentum={false}
              dragConstraints={planRef}
              dragElastic={0}
              whileDrag={{ scale: 1.04 }}
              onDragStart={() => (justDragged.current = true)}
              onDragEnd={(e) => {
                onDrop(tb, (e.target as HTMLElement).closest("[data-table]") as HTMLElement);
                setTimeout(() => (justDragged.current = false), 50);
              }}
              data-table
            >
              <TablePiece
                table={tb}
                now={now}
                editing={editing}
                onClick={() => {
                  if (justDragged.current) return;
                  if (editing) return setForm({ open: true, table: tb });
                  openTable(tb);
                }}
              />
            </motion.div>
          ))}
        </div>
      </div>
      )}

      {newOrder && (
        <NewOrderModal
          open
          onClose={() => setNewOrder(null)}
          waiters={waiters}
          couriers={couriers}
          freeTables={freeTables}
          presetTableId={newOrder.tableId ?? undefined}
          presetType={newOrder.tableId ? "DINE_IN" : "TAKEAWAY"}
          reservation={newOrder.reservation}
        />
      )}
      <TableForm
        key={form.table?.id ?? `new-${form.open}`}
        open={form.open}
        table={form.table}
        nextNumber={Math.max(0, ...tables.map((x) => x.number)) + 1}
        onClose={() => setForm({ open: false })}
      />
    </>
  );
}

function FloorLabel({ children, className, door }: { children: React.ReactNode; className: string; door?: boolean }) {
  return (
    <span
      className={`absolute z-[1] rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted ${
        door ? "border-saffron/40 text-saffron" : ""
      } ${className}`}
    >
      {children}
    </span>
  );
}
