"use client";

import { useEffect, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Bike, Check, Crosshair, Loader2, MapPin, Minus, Plus, Search, ShoppingBag, Store, Trash2, X } from "lucide-react";
import { useI18n } from "@/components/Providers";
import { fmt } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { SITE, distanceKm } from "@/lib/site";
import { submitSiteOrder } from "@/app/actions/site";
import { useCart, MIN_ORDER } from "./cart";
import { geocode, reverseGeocode } from "./geo";
import type { LatLng } from "@/components/map/LeafletMap";

const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
  ssr: false,
  loading: () => <div className="skeleton h-56 rounded-[var(--radius-card)]" />,
});

type Step = "cart" | "checkout" | "done";

export function CartDrawer() {
  const { t } = useI18n();
  const cart = useCart();
  const [step, setStep] = useState<Step>("cart");
  const [done, setDone] = useState<{ id: number; phone: string } | null>(null);

  // закрыли панель после успешного заказа — в следующий раз начинаем с корзины
  useEffect(() => {
    if (cart.open) return;
    const id = setTimeout(() => {
      if (step === "done") setStep("cart");
    }, 300);
    return () => clearTimeout(id);
  }, [cart.open, step]);

  useEffect(() => {
    if (!cart.open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cart.setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [cart]);

  return (
    <AnimatePresence>
      {cart.open && (
        <motion.div className="fixed inset-0 z-[70]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/55" onClick={() => cart.setOpen(false)} />
          <motion.aside
            role="dialog"
            aria-modal
            aria-label={t.site.cart.title}
            className="absolute inset-y-0 right-0 flex w-full max-w-[480px] flex-col border-l border-line bg-bg"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 40 }}
          >
            <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-5">
              {step === "checkout" && (
                <button type="button" onClick={() => setStep("cart")} className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-text" aria-label="←">
                  <ArrowLeft size={20} strokeWidth={1.75} />
                </button>
              )}
              <h2 className="font-display text-xl font-semibold">{step === "checkout" ? t.site.checkout.title : t.site.cart.title}</h2>
              <button type="button" onClick={() => cart.setOpen(false)} className="ml-auto flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-text" aria-label="×">
                <X size={20} strokeWidth={1.75} />
              </button>
            </header>

            {step === "cart" && <CartStep onNext={() => setStep("checkout")} />}
            {step === "checkout" && (
              <CheckoutStep
                onDone={(id, phone) => {
                  setDone({ id, phone });
                  setStep("done");
                  cart.clear();
                }}
              />
            )}
            {step === "done" && done && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
                <motion.span
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-mint/15 text-mint"
                >
                  <Check size={40} strokeWidth={2} />
                </motion.span>
                <h3 className="font-display text-2xl font-semibold">{fmt(t.site.checkout.successTitle, { n: done.id })}</h3>
                <p className="max-w-xs text-muted">{fmt(t.site.checkout.successText, { phone: done.phone })}</p>
                <button type="button" onClick={() => cart.setOpen(false)} className="mt-4 h-12 rounded-full bg-saffron px-8 font-semibold text-on-saffron hover:brightness-110">
                  {t.site.checkout.done}
                </button>
              </div>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stepper({ id, qty }: { id: number; qty: number }) {
  const cart = useCart();
  return (
    <div className="flex h-9 items-center rounded-full border border-line">
      <button type="button" onClick={() => cart.dec(id)} className="flex h-9 w-9 items-center justify-center text-muted hover:text-text" aria-label="−">
        <Minus size={15} strokeWidth={2} />
      </button>
      <span className="num w-6 text-center text-sm font-semibold">{qty}</span>
      <button type="button" onClick={() => cart.add(id)} className="flex h-9 w-9 items-center justify-center text-muted hover:text-text" aria-label="+">
        <Plus size={15} strokeWidth={2} />
      </button>
    </div>
  );
}

function CartStep({ onNext }: { onNext: () => void }) {
  const { t } = useI18n();
  const cart = useCart();
  if (cart.lines.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-muted">
          <ShoppingBag size={28} strokeWidth={1.5} />
        </span>
        <p className="font-display text-lg font-semibold">{t.site.cart.empty}</p>
        <p className="text-sm text-muted">{t.site.cart.emptyText}</p>
      </div>
    );
  }
  const left = MIN_ORDER - cart.subtotal;
  return (
    <>
      <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
        <AnimatePresence initial={false}>
          {cart.lines.map((l) => (
            <motion.li key={l.dishId} layout exit={{ opacity: 0, x: 40 }} className="flex items-center gap-3 py-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {l.dish.photo && <img src={l.dish.photo} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{l.dish.name}</div>
                <div className="num text-sm text-muted">{formatMoney(l.dish.price * l.qty)}</div>
              </div>
              <Stepper id={l.dishId} qty={l.qty} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <footer className="shrink-0 border-t border-line p-5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-muted">{t.site.cart.subtotal}</span>
          <span className="num font-display text-2xl font-semibold">{formatMoney(cart.subtotal)}</span>
        </div>
        {left > 0 ? (
          <p className="mb-4 text-sm text-apricot">{fmt(t.site.cart.toMin, { sum: formatMoney(left) })}</p>
        ) : cart.subtotal < SITE.freeDeliveryFrom ? (
          <p className="mb-4 text-sm text-muted">{fmt(t.site.cart.toFree, { sum: formatMoney(SITE.freeDeliveryFrom - cart.subtotal) })}</p>
        ) : (
          <p className="mb-4 text-sm text-mint">
            {t.site.cart.delivery}: {t.site.cart.free}
          </p>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={cart.clear} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line text-muted hover:border-pomegranate/50 hover:text-pomegranate" aria-label={t.site.cart.clear} title={t.site.cart.clear}>
            <Trash2 size={18} strokeWidth={1.75} />
          </button>
          <button type="button" disabled={left > 0} onClick={onNext} className="h-14 flex-1 rounded-full bg-saffron font-semibold text-on-saffron shadow-[0_0_24px_var(--glow)] transition-[filter,transform] hover:brightness-110 active:scale-[0.98] disabled:opacity-40">
            {t.site.cart.checkout}
          </button>
        </div>
      </footer>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}
const inputCls = "h-12 w-full rounded-xl border border-line bg-surface px-4 text-[15px] outline-none transition-colors placeholder:text-muted/60 focus:border-saffron/60";

function CheckoutStep({ onDone }: { onDone: (id: number, phone: string) => void }) {
  const { t, locale } = useI18n();
  const cart = useCart();
  const [type, setType] = useState<"DELIVERY" | "TAKEAWAY">("DELIVERY");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+992 ");
  const [address, setAddress] = useState("");
  const [point, setPoint] = useState<LatLng | null>(null);
  const [center, setCenter] = useState<LatLng>({ lat: SITE.lat, lng: SITE.lng });
  const [geoState, setGeoState] = useState<"idle" | "busy" | "notFound">("idle");
  const [pay, setPay] = useState<"CASH" | "CARD">("CASH");
  const [comment, setComment] = useState("");
  const [website, setWebsite] = useState(""); // ловушка для ботов
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const lang = locale === "tg" ? "tg,ru" : "ru";

  const km = point ? distanceKm(SITE.lat, SITE.lng, point.lat, point.lng) : null;
  const outOfZone = km !== null && km > SITE.deliveryRadiusKm;
  const fee = cart.deliveryFee(type);
  const total = cart.subtotal + fee;

  // гость передвинул метку — подставляем адрес (квартиру он допишет сам)
  const pick = async (p: LatLng) => {
    setPoint(p);
    setGeoState("busy");
    try {
      const label = await reverseGeocode(p.lat, p.lng, lang);
      if (label) setAddress(label);
      setGeoState("idle");
    } catch {
      setGeoState("idle");
    }
  };

  const find = async () => {
    if (!address.trim()) return;
    setGeoState("busy");
    try {
      const hit = await geocode(address, lang);
      if (!hit) return setGeoState("notFound");
      setPoint({ lat: hit.lat, lng: hit.lng });
      setCenter({ lat: hit.lat, lng: hit.lng });
      setGeoState("idle");
    } catch {
      setGeoState("notFound");
    }
  };

  const locate = () => {
    if (!navigator.geolocation) return;
    setGeoState("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCenter(p);
        void pick(p);
      },
      () => setGeoState("idle"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        const res = await submitSiteOrder({
          type,
          name,
          phone,
          address: type === "DELIVERY" ? address : undefined,
          lat: type === "DELIVERY" ? point?.lat : null,
          lng: type === "DELIVERY" ? point?.lng : null,
          payMethod: pay,
          comment,
          items: cart.lines.map((l) => ({ dishId: l.dishId, qty: l.qty })),
          website,
        });
        if (res.ok && res.data) onDone(res.data.id, phone);
        else if (!res.ok) setError((t.errors as Record<string, string>)[res.error] ?? t.errors.generic);
      } catch {
        setError(t.errors.generic);
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {/* способ получения */}
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-surface p-1.5">
          {([
            ["DELIVERY", Bike, t.site.checkout.delivery],
            ["TAKEAWAY", Store, t.site.checkout.takeaway],
          ] as const).map(([v, Icon, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setType(v)}
              aria-pressed={type === v}
              className={`relative flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors ${type === v ? "text-on-saffron" : "text-muted hover:text-text"}`}
            >
              {type === v && <motion.span layoutId="checkout-type" className="absolute inset-0 rounded-xl bg-saffron" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
              <Icon size={18} strokeWidth={1.75} className="relative" />
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.site.checkout.name}>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" />
          </Field>
          <Field label={t.site.checkout.phone}>
            <input className={`${inputCls} num`} value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={30} inputMode="tel" autoComplete="tel" />
          </Field>
        </div>

        {type === "DELIVERY" ? (
          <div className="space-y-3">
            <Field label={t.site.checkout.address}>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    if (geoState === "notFound") setGeoState("idle");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void find();
                    }
                  }}
                  placeholder={t.site.checkout.addressPh}
                  required
                  maxLength={200}
                  autoComplete="street-address"
                />
                <button type="button" onClick={find} className="flex h-12 shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-medium hover:border-saffron/50 hover:text-saffron" title={t.site.checkout.find}>
                  <Search size={16} strokeWidth={1.75} />
                  <span className="hidden sm:inline">{t.site.checkout.find}</span>
                </button>
              </div>
            </Field>
            <div className="relative">
              <LeafletMap center={center} marker={point} home={{ lat: SITE.lat, lng: SITE.lng }} radiusKm={SITE.deliveryRadiusKm} draggable onPick={pick} zoom={13} className="h-60" />
              <button
                type="button"
                onClick={locate}
                className="absolute right-3 top-3 z-[500] inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-semibold shadow hover:text-saffron"
              >
                <Crosshair size={14} strokeWidth={2} />
                {t.site.checkout.locate}
              </button>
            </div>
            <p className={`flex items-center gap-1.5 text-xs ${outOfZone || geoState === "notFound" ? "text-pomegranate" : "text-muted"}`}>
              {geoState === "busy" ? <Loader2 size={13} className="animate-spin" /> : <MapPin size={13} strokeWidth={2} />}
              {geoState === "busy"
                ? t.site.checkout.searching
                : geoState === "notFound"
                  ? t.site.checkout.notFound
                  : outOfZone
                    ? fmt(t.site.checkout.outOfZone, { km: km!.toFixed(1) })
                    : point
                      ? `${fmt(t.site.checkout.distance, { km: km!.toFixed(1) })} · ${t.site.checkout.mapHint}`
                      : t.site.checkout.mapHint}
            </p>
          </div>
        ) : (
          <p className="flex items-start gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm">
            <Store size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-saffron" />
            {fmt(t.site.checkout.takeawayAt, { address: SITE.address[locale === "tg" ? "tg" : "ru"] })}
          </p>
        )}

        <Field label={t.site.checkout.pay}>
          <div className="grid grid-cols-2 gap-2">
            {(["CASH", "CARD"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setPay(v)}
                aria-pressed={pay === v}
                className={`h-12 rounded-xl border text-sm font-medium transition-colors ${pay === v ? "border-saffron/60 bg-saffron/10 text-saffron" : "border-line text-muted hover:text-text"}`}
              >
                {v === "CASH" ? t.site.checkout.cash : t.site.checkout.card}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t.site.checkout.comment}>
          <textarea className={`${inputCls} h-20 resize-none py-3`} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} placeholder={t.site.checkout.commentPh} />
        </Field>
        {/* скрытое поле: люди его не видят, боты заполняют */}
        <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      </div>

      <footer className="shrink-0 space-y-2 border-t border-line p-5">
        <div className="flex justify-between text-sm text-muted">
          <span>{t.site.cart.subtotal}</span>
          <span className="num">{formatMoney(cart.subtotal)}</span>
        </div>
        {type === "DELIVERY" && (
          <div className="flex justify-between text-sm text-muted">
            <span>{t.site.cart.delivery}</span>
            <span className="num">{fee ? formatMoney(fee) : t.site.cart.free}</span>
          </div>
        )}
        {error && <p className="rounded-xl bg-pomegranate/12 px-3 py-2 text-sm text-pomegranate" role="alert">{error}</p>}
        <button
          type="submit"
          disabled={pending || (type === "DELIVERY" && outOfZone)}
          className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-saffron font-semibold text-on-saffron shadow-[0_0_24px_var(--glow)] transition-[filter,transform] hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
        >
          {pending && <Loader2 size={18} className="animate-spin" />}
          {fmt(t.site.checkout.submit, { sum: formatMoney(total) })}
        </button>
      </footer>
    </form>
  );
}
