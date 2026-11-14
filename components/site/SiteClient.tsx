"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import {
  ArrowRight,
  Bike,
  Clock,
  CookingPot,
  Coffee,
  Flame,
  MapPin,
  Menu as MenuIcon,
  Minus,
  Navigation,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Star,
  Wallet,
  X,
} from "lucide-react";
import { useI18n } from "@/components/Providers";
import { LaganMark } from "@/components/Logo";
import { SuzaniRosette, SuzaniStrip } from "@/components/Ornament";
import { PrefsToggles } from "@/components/shell/PrefsToggles";
import { Reveal } from "@/components/ui/Reveal";
import { fmt } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { SITE } from "@/lib/site";
import { CartProvider, useCart } from "./cart";
import { CartDrawer } from "./CartDrawer";
import { BookingForm } from "./BookingForm";

const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
  ssr: false,
  loading: () => <div className="skeleton h-full min-h-80 rounded-[var(--radius-card)]" />,
});

export type SiteDish = { id: number; name: string; description: string | null; price: number; photo: string | null; stopped: boolean };
export type SiteCategory = { id: number; name: string; dishes: SiteDish[] };
export type SiteFeatured = { hero: number | null; signature: number[]; about: string[]; booking: string | null };

// ---------- открыто / закрыто (время браузера, обновляется раз в минуту) ----------
function subscribeMinute(cb: () => void) {
  const id = setInterval(cb, 60_000);
  return () => clearInterval(id);
}
const currentHour = () => new Date().getHours();
function useOpenNow() {
  const h = useSyncExternalStore(subscribeMinute, currentHour, () => -1);
  if (h < 0) return null;
  return h >= SITE.openHour && h < SITE.closeHour;
}

export function SiteClient({ restaurantName, menu, featured }: { restaurantName: string; menu: SiteCategory[]; featured: SiteFeatured }) {
  const dishes = useMemo(() => menu.flatMap((c) => c.dishes), [menu]);
  return (
    <CartProvider dishes={dishes}>
      <div className="site-root min-h-screen overflow-x-clip">
        <Header name={restaurantName} />
        <main>
          <Hero dishes={dishes} featured={featured} />
          <Marquee dishes={dishes} />
          <Signature dishes={dishes} ids={featured.signature} />
          <MenuSection menu={menu} />
          <DeliveryBand />
          <About photos={featured.about} />
          <Reviews />
          <Booking photo={featured.booking} />
          <Contacts />
        </main>
        <Footer name={restaurantName} />
        <FloatingCart />
        <CartDrawer />
      </div>
    </CartProvider>
  );
}

// ---------- общие кусочки ----------

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-saffron">
      <span className="h-px w-8 bg-saffron/60" />
      {children}
    </p>
  );
}

function SectionTitle({ kicker, title, center }: { kicker: string; title: string; center?: boolean }) {
  return (
    <Reveal className={center ? "flex flex-col items-center text-center" : ""}>
      <Kicker>{kicker}</Kicker>
      <h2 className="mt-4 max-w-3xl font-display text-[clamp(32px,4.4vw,60px)] font-semibold leading-[1.05]">{title}</h2>
    </Reveal>
  );
}

function AddButton({ dish, size = "md" }: { dish: SiteDish; size?: "md" | "lg" }) {
  const { t } = useI18n();
  const cart = useCart();
  const qty = cart.qtyOf(dish.id);
  const h = size === "lg" ? "h-12" : "h-10";
  if (dish.stopped) {
    return <span className={`inline-flex ${h} items-center rounded-full border border-line px-4 text-sm text-muted`}>{t.site.menu.stopped}</span>;
  }
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {qty === 0 ? (
        <motion.button
          key="add"
          type="button"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          onClick={() => cart.add(dish.id)}
          className={`inline-flex ${h} items-center gap-2 rounded-full bg-saffron px-4 text-sm font-semibold text-on-saffron transition-[filter,transform] hover:brightness-110 active:scale-95`}
        >
          <Plus size={16} strokeWidth={2.25} />
          {t.site.menu.add}
        </motion.button>
      ) : (
        <motion.div
          key="qty"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className={`inline-flex ${h} items-center rounded-full bg-saffron text-on-saffron`}
        >
          <button type="button" onClick={() => cart.dec(dish.id)} className={`flex ${h} w-10 items-center justify-center`} aria-label="−">
            <Minus size={16} strokeWidth={2.25} />
          </button>
          <span className="num w-6 text-center text-sm font-bold">{qty}</span>
          <button type="button" onClick={() => cart.add(dish.id)} className={`flex ${h} w-10 items-center justify-center`} aria-label="+">
            <Plus size={16} strokeWidth={2.25} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DishPhoto({ dish, className = "" }: { dish: SiteDish; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-surface-2 ${className}`}>
      {dish.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dish.photo} alt={dish.name} loading="lazy" className={`h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 ${dish.stopped ? "grayscale" : ""}`} />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-saffron/40">
          <LaganMark size={56} />
        </div>
      )}
    </div>
  );
}

// ---------- шапка ----------

function Header({ name }: { name: string }) {
  const { t } = useI18n();
  const cart = useCart();
  const [mobile, setMobile] = useState(false);
  const { scrollY } = useScroll();
  const solid = useTransform(scrollY, [0, 80], [0, 1]);
  const links: [string, string][] = [
    ["#menu", t.site.nav.menu],
    ["#about", t.site.nav.about],
    ["#reviews", t.site.nav.reviews],
    ["#booking", t.site.nav.booking],
    ["#contacts", t.site.nav.contacts],
  ];
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <motion.div style={{ opacity: solid }} className="absolute inset-0 border-b border-line/70 bg-bg/85 backdrop-blur-md" />
      <div className="relative mx-auto flex h-16 max-w-[1320px] items-center gap-6 px-4 sm:px-6 lg:h-20 lg:px-10">
        <a href="#top" className="flex items-center gap-2.5">
          <LaganMark size={36} />
          <span className="font-display text-lg font-semibold tracking-tight">{name}</span>
        </a>
        <nav className="hidden items-center gap-1 lg:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="rounded-full px-3.5 py-2 text-[15px] text-muted transition-colors hover:bg-surface-2 hover:text-text">
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <a href={SITE.phoneHref} className="num hidden items-center gap-2 text-sm font-medium xl:flex">
            <Phone size={16} strokeWidth={1.75} className="text-saffron" />
            {SITE.phone}
          </a>
          <div className="hidden sm:block">
            <PrefsToggles />
          </div>
          <button
            type="button"
            onClick={() => cart.setOpen(true)}
            className="relative flex h-11 items-center gap-2 rounded-full bg-saffron px-4 font-semibold text-on-saffron transition-[filter] hover:brightness-110"
            aria-label={t.site.cart.open}
          >
            <ShoppingBag size={18} strokeWidth={2} />
            <span className="hidden sm:inline">{t.site.cart.open}</span>
            <AnimatePresence>
              {cart.count > 0 && (
                <motion.span
                  key={cart.count}
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  className="num absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-pomegranate px-1.5 text-xs font-bold text-on-pomegranate"
                >
                  {cart.count}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          <button type="button" onClick={() => setMobile(true)} className="flex h-11 w-11 items-center justify-center rounded-full border border-line lg:hidden" aria-label="menu">
            <MenuIcon size={20} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobile && (
          <motion.div className="fixed inset-0 z-[60] bg-bg lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex h-16 items-center justify-between px-4">
              <span className="flex items-center gap-2.5 font-display text-lg font-semibold">
                <LaganMark size={36} />
                {name}
              </span>
              <button type="button" onClick={() => setMobile(false)} className="flex h-11 w-11 items-center justify-center rounded-full border border-line" aria-label="×">
                <X size={20} strokeWidth={1.75} />
              </button>
            </div>
            <nav className="flex flex-col px-6 pt-6">
              {links.map(([href, label], i) => (
                <motion.a
                  key={href}
                  href={href}
                  onClick={() => setMobile(false)}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i }}
                  className="border-b border-line py-4 font-display text-3xl font-semibold"
                >
                  {label}
                </motion.a>
              ))}
            </nav>
            <div className="mt-8 flex flex-col gap-4 px-6">
              <a href={SITE.phoneHref} className="num flex items-center gap-2 text-lg">
                <Phone size={18} strokeWidth={1.75} className="text-saffron" />
                {SITE.phone}
              </a>
              <PrefsToggles />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

// ---------- первый экран ----------

function Hero({ dishes, featured }: { dishes: SiteDish[]; featured: SiteFeatured }) {
  const { t } = useI18n();
  const open = useOpenNow();
  const hero = dishes.find((d) => d.id === featured.hero) ?? dishes.find((d) => d.photo) ?? dishes[0];
  const daily = dishes.find((d) => d.id === featured.signature[1]) ?? hero;
  const { scrollY } = useScroll();
  const photoY = useTransform(scrollY, [0, 600], [0, 60]);
  const rosetteRotate = useTransform(scrollY, [0, 800], [0, 40]);

  return (
    <section id="top" className="relative overflow-hidden pb-16 pt-24 lg:pb-24 lg:pt-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_75%_35%,var(--glow),transparent_55%)]" />
      <div className="relative mx-auto grid max-w-[1320px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:px-10">
        <div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-wrap items-center gap-3">
            {open !== null && (
              <span className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-sm ${open ? "border-mint/40 text-mint" : "border-line text-muted"}`}>
                <span className={`h-2 w-2 rounded-full ${open ? "bg-mint motion-safe:animate-pulse" : "bg-muted"}`} />
                {open ? fmt(t.site.openNow, { h: SITE.closeHour }) : fmt(t.site.closedNow, { h: SITE.openHour })}
              </span>
            )}
            <span className="text-sm text-muted">{t.site.hero.kicker}</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
            className="mt-6 font-display text-[clamp(44px,6.6vw,96px)] font-semibold leading-[0.98] tracking-tight"
          >
            {t.site.hero.title}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.16 }} className="mt-6 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">
            {t.site.hero.lead}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.24 }} className="mt-9 flex flex-wrap gap-3">
            <a href="#menu" className="inline-flex h-14 items-center gap-2.5 rounded-full bg-saffron px-7 font-semibold text-on-saffron shadow-[0_0_32px_var(--glow)] transition-[filter,transform] hover:brightness-110 active:scale-[0.98]">
              <Bike size={20} strokeWidth={2} />
              {t.site.hero.order}
            </a>
            <a href="#booking" className="inline-flex h-14 items-center gap-2.5 rounded-full border border-line bg-surface/60 px-7 font-semibold transition-colors hover:border-saffron/50 hover:text-saffron">
              {t.site.hero.book}
              <ArrowRight size={18} strokeWidth={2} />
            </a>
          </motion.div>
          <motion.dl initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.4 }} className="mt-12 flex flex-wrap gap-x-10 gap-y-5">
            <div>
              <dt className="flex items-center gap-1.5 font-display text-3xl font-semibold">
                4,9 <Star size={20} className="fill-saffron text-saffron" />
              </dt>
              <dd className="text-sm text-muted">{t.site.hero.rating}</dd>
            </div>
            <div>
              <dt className="font-display text-3xl font-semibold">{t.site.delivery.time}</dt>
              <dd className="text-sm text-muted">{t.site.delivery.title}</dd>
            </div>
            <div>
              <dt className="num font-display text-3xl font-semibold">
                {SITE.openHour}:00–{SITE.closeHour}:00
              </dt>
              <dd className="text-sm text-muted">{t.site.contacts.hours}</dd>
            </div>
          </motion.dl>
        </div>

        {/* фото в арке — как айван чайханы */}
        <div className="relative mx-auto w-full max-w-[520px]">
          <motion.div style={{ rotate: rosetteRotate }} className="pointer-events-none absolute -right-24 -top-16 hidden text-saffron/15 sm:block">
            <SuzaniRosette size={360} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className="absolute -inset-3 rounded-t-[999px] rounded-b-[32px] border border-saffron/35" />
            <div className="relative aspect-[4/5] overflow-hidden rounded-t-[999px] rounded-b-[28px] bg-surface-2">
              {hero?.photo && (
                <motion.img style={{ y: photoY, scale: 1.12 }} src={hero.photo} alt={hero.name} className="h-full w-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
            </div>
          </motion.div>
          {/* блюдо дня */}
          {daily && (
            <motion.div
              initial={{ opacity: 0, y: 24, x: -12 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              transition={{ duration: 0.7, delay: 0.5 }}
              className="absolute -bottom-6 -left-2 flex w-[290px] items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-2xl backdrop-blur sm:-left-10"
            >
              <DishPhoto dish={daily} className="h-16 w-16 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-saffron">{t.site.hero.dishOfDay}</div>
                <div className="truncate font-display font-semibold">{daily.name}</div>
                <div className="num text-sm text-muted">{formatMoney(daily.price)}</div>
              </div>
              <AddMini dish={daily} />
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}

function AddMini({ dish }: { dish: SiteDish }) {
  const cart = useCart();
  const qty = cart.qtyOf(dish.id);
  if (dish.stopped) return null;
  return (
    <button
      type="button"
      onClick={() => cart.add(dish.id)}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-saffron text-on-saffron transition-transform active:scale-90"
      aria-label="+"
    >
      <Plus size={20} strokeWidth={2.25} />
      {qty > 0 && <span className="num absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-pomegranate px-1 text-[11px] font-bold text-on-pomegranate">{qty}</span>}
    </button>
  );
}

// ---------- бегущая строка ----------

function Marquee({ dishes }: { dishes: SiteDish[] }) {
  const names = dishes.slice(0, 14).map((d) => d.name);
  const row = (
    <div className="flex shrink-0 items-center gap-8 pr-8">
      {names.map((n, i) => (
        <span key={i} className="flex items-center gap-8 whitespace-nowrap font-display text-2xl font-semibold text-muted/70 sm:text-3xl">
          {n}
          <span className="h-2.5 w-2.5 rotate-45 bg-saffron/70" />
        </span>
      ))}
    </div>
  );
  return (
    <div className="relative border-y border-line bg-surface py-5" aria-hidden>
      <div className="flex w-max motion-safe:animate-[marquee_45s_linear_infinite]">
        {row}
        {row}
      </div>
    </div>
  );
}

// ---------- фирменные блюда ----------

function Signature({ dishes, ids }: { dishes: SiteDish[]; ids: number[] }) {
  const { t } = useI18n();
  const list = ids.map((id) => dishes.find((d) => d.id === id)).filter((d): d is SiteDish => !!d);
  if (list.length === 0) return null;
  return (
    <section className="mx-auto max-w-[1320px] px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
      <SectionTitle kicker={t.site.signature.kicker} title={t.site.signature.title} />
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {list.map((d, i) => (
          <Reveal key={d.id} delay={i * 0.08}>
            <article className={`group flex h-full flex-col ${i === 1 ? "md:mt-16" : ""}`}>
              <div className="relative">
                <DishPhoto dish={d} className="aspect-[4/5] rounded-[28px]" />
                <span className="num absolute left-5 top-4 font-display text-5xl font-semibold text-white/85 drop-shadow">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <div className="mt-5 flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-2xl font-semibold">{d.name}</h3>
                  {d.description && <p className="mt-1.5 text-muted">{d.description}</p>}
                </div>
                <span className="num shrink-0 font-display text-xl font-semibold text-saffron">{formatMoney(d.price, { currency: false })}</span>
              </div>
              <div className="mt-4">
                <AddButton dish={d} size="lg" />
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ---------- меню ----------

function MenuSection({ menu }: { menu: SiteCategory[] }) {
  const { t } = useI18n();
  const [cat, setCat] = useState<number | "all">("all");
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const shown = menu
    .filter((c) => cat === "all" || c.id === cat)
    .map((c) => ({ ...c, dishes: query ? c.dishes.filter((d) => `${d.name} ${d.description ?? ""}`.toLowerCase().includes(query)) : c.dishes }))
    .filter((c) => c.dishes.length > 0);

  return (
    <section id="menu" className="scroll-mt-16 border-t border-line bg-surface/40 py-24 lg:py-32">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
        <SectionTitle kicker={t.site.menu.kicker} title={t.site.menu.title} />

        {/* категории прилипают под шапкой */}
        <div className="sticky top-16 z-30 -mx-4 mt-10 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-20 lg:-mx-10 lg:px-10">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {[{ id: "all" as const, name: t.site.menu.all }, ...menu.map((c) => ({ id: c.id, name: c.name }))].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCat(c.id)}
                  className={`relative h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors ${cat === c.id ? "text-on-saffron" : "border border-line text-muted hover:text-text"}`}
                >
                  {cat === c.id && <motion.span layoutId="site-cat" className="absolute inset-0 rounded-full bg-saffron" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                  <span className="relative">{c.name}</span>
                </button>
              ))}
            </div>
            <label className="relative md:ml-auto md:w-64">
              <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t.site.menu.search}
                className="h-10 w-full rounded-full border border-line bg-surface pl-10 pr-4 text-sm outline-none focus:border-saffron/60"
              />
            </label>
          </div>
        </div>

        {shown.length === 0 && <p className="py-20 text-center text-muted">{t.site.menu.nothing}</p>}
        {shown.map((c) => (
          <div key={c.id} className="mt-12">
            <h3 className="mb-6 flex items-center gap-4 font-display text-2xl font-semibold">
              {c.name}
              <span className="h-px flex-1 bg-line" />
            </h3>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {c.dishes.map((d, i) => (
                <Reveal key={d.id} delay={Math.min(i, 6) * 0.05}>
                  <article className={`group flex h-full flex-col overflow-hidden rounded-[22px] border border-line bg-surface transition-colors hover:border-saffron/30 ${d.stopped ? "opacity-60" : ""}`}>
                    <DishPhoto dish={d} className="aspect-[4/3]" />
                    <div className="flex flex-1 flex-col p-4">
                      <h4 className="font-display text-lg font-semibold leading-snug">{d.name}</h4>
                      {d.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{d.description}</p>}
                      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                        <span className="num font-display text-lg font-semibold">{formatMoney(d.price)}</span>
                        <AddButton dish={d} />
                      </div>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- доставка ----------

function DeliveryBand() {
  const { t } = useI18n();
  const items = [
    { icon: Clock, title: t.site.delivery.time, text: t.site.delivery.title },
    { icon: Bike, title: fmt(t.site.delivery.fee, { fee: formatMoney(SITE.deliveryFee), free: formatMoney(SITE.freeDeliveryFrom) }), text: "" },
    { icon: Wallet, title: fmt(t.site.delivery.min, { min: formatMoney(SITE.minOrder) }), text: `${t.site.checkout.cash} · ${t.site.checkout.card}` },
  ];
  return (
    <section className="bg-saffron text-on-saffron">
      <div className="mx-auto grid max-w-[1320px] gap-6 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-10">
        {items.map(({ icon: Icon, title, text }, i) => (
          <div key={i} className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-on-saffron/10">
              <Icon size={22} strokeWidth={1.75} />
            </span>
            <div>
              <div className="font-display text-lg font-semibold leading-tight">{title}</div>
              {text && <div className="text-sm opacity-75">{text}</div>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- о нас ----------

function About({ photos }: { photos: string[] }) {
  const { t } = useI18n();
  const features = [
    { icon: Flame, title: t.site.about.f1t, text: t.site.about.f1 },
    { icon: CookingPot, title: t.site.about.f2t, text: t.site.about.f2 },
    { icon: Coffee, title: t.site.about.f3t, text: t.site.about.f3 },
  ];
  return (
    <section id="about" className="relative scroll-mt-16 overflow-hidden py-24 lg:py-32">
      <div className="mx-auto grid max-w-[1320px] items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:px-10">
        {/* коллаж */}
        <div className="relative grid h-[460px] grid-cols-2 grid-rows-6 gap-4 sm:h-[560px]">
          {photos[0] && <CollagePhoto src={photos[0]} className="col-start-1 row-span-4 row-start-1" delay={0} />}
          {photos[1] && <CollagePhoto src={photos[1]} className="col-start-2 row-span-3 row-start-2" delay={0.1} />}
          {photos[2] && <CollagePhoto src={photos[2]} className="col-start-1 row-span-2 row-start-5" delay={0.2} />}
          {photos[3] && <CollagePhoto src={photos[3]} className="col-start-2 row-span-2 row-start-5" delay={0.3} />}
          <div className="pointer-events-none absolute -bottom-10 -left-10 text-saffron/15">
            <SuzaniRosette size={200} />
          </div>
        </div>
        <div>
          <SectionTitle kicker={t.site.about.kicker} title={t.site.about.title} />
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">{t.site.about.text}</p>
          </Reveal>
          <div className="mt-10 flex flex-col gap-6">
            {features.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delay={0.15 + i * 0.06}>
                <div className="flex gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-saffron/30 bg-saffron/10 text-saffron">
                    <Icon size={22} strokeWidth={1.75} />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-semibold">{title}</h3>
                    <p className="text-muted">{text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CollagePhoto({ src, className, delay }: { src: string; className: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`overflow-hidden rounded-[24px] bg-surface-2 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
    </motion.div>
  );
}

// ---------- отзывы ----------

const REVIEW_META = [
  { k: "a", stars: 5, date: "02.11.2026" },
  { k: "b", stars: 5, date: "28.10.2026" },
  { k: "c", stars: 5, date: "19.10.2026" },
  { k: "d", stars: 4, date: "11.10.2026" },
  { k: "e", stars: 5, date: "03.10.2026" },
  { k: "f", stars: 5, date: "27.09.2026" },
] as const;

function Reviews() {
  const { t } = useI18n();
  const tones = ["bg-saffron/15 text-saffron", "bg-lapis/15 text-lapis", "bg-mint/15 text-mint", "bg-pomegranate/15 text-pomegranate", "bg-apricot/15 text-apricot"];
  return (
    <section id="reviews" className="scroll-mt-16 border-y border-line bg-surface/40 py-24 lg:py-32">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionTitle kicker={t.site.reviews.kicker} title={t.site.reviews.title} />
          <Reveal>
            <div className="flex items-center gap-4">
              <span className="font-display text-6xl font-semibold">4,9</span>
              <div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} size={20} className="fill-saffron text-saffron" />
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted">{t.site.reviews.note}</p>
              </div>
            </div>
          </Reveal>
        </div>
        <div className="mt-14 columns-1 gap-5 md:columns-2 lg:columns-3">
          {REVIEW_META.map((r, i) => {
            const item = t.site.reviews.items[r.k];
            return (
              <Reveal key={r.k} delay={(i % 3) * 0.06} className="mb-5 break-inside-avoid">
                <figure className="rounded-[22px] border border-line bg-surface p-6">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }, (_, s) => (
                      <Star key={s} size={16} className={s < r.stars ? "fill-saffron text-saffron" : "text-line"} />
                    ))}
                  </div>
                  <blockquote className="mt-4 text-[17px] leading-relaxed">«{item.text}»</blockquote>
                  <figcaption className="mt-5 flex items-center gap-3">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-full font-display font-semibold ${tones[i % tones.length]}`}>{item.name[0]}</span>
                    <span>
                      <span className="block font-semibold">{item.name}</span>
                      <span className="num text-xs text-muted">{r.date}</span>
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------- бронь ----------

function Booking({ photo }: { photo: string | null }) {
  const { t } = useI18n();
  return (
    <section id="booking" className="scroll-mt-16 py-24 lg:py-32">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
        <div className="grid overflow-hidden rounded-[32px] border border-line bg-surface lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative min-h-72 overflow-hidden">
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
            <div className="relative flex h-full flex-col justify-end gap-3 p-8 text-white">
              <SuzaniStrip className="mb-2 block text-saffron/70" />
              <p className="font-display text-2xl font-semibold leading-tight">{t.site.booking.banquet}</p>
              <p className="num flex items-center gap-2 text-white/80">
                <Clock size={16} strokeWidth={1.75} />
                {fmt(t.site.contacts.hoursValue, { o: SITE.openHour, c: SITE.closeHour })}
              </p>
            </div>
          </div>
          <div className="p-6 sm:p-10">
            <Kicker>{t.site.booking.kicker}</Kicker>
            <h2 className="mt-4 font-display text-[clamp(30px,3.6vw,48px)] font-semibold leading-tight">{t.site.booking.title}</h2>
            <p className="mb-8 mt-3 text-muted">{t.site.booking.lead}</p>
            <BookingForm />
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- контакты ----------

function Contacts() {
  const { t, locale } = useI18n();
  const address = SITE.address[locale === "tg" ? "tg" : "ru"];
  const rows = [
    { icon: MapPin, label: t.site.contacts.address, value: address },
    { icon: Phone, label: t.site.contacts.phone, value: SITE.phone, href: SITE.phoneHref },
    { icon: Clock, label: t.site.contacts.hours, value: fmt(t.site.contacts.hoursValue, { o: SITE.openHour, c: SITE.closeHour }) },
  ];
  return (
    <section id="contacts" className="scroll-mt-16 border-t border-line pb-24 pt-24 lg:pt-32">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-10">
        <div>
          <SectionTitle kicker={t.site.contacts.kicker} title={t.site.contacts.title} />
          <dl className="mt-10 flex flex-col gap-6">
            {rows.map(({ icon: Icon, label, value, href }) => (
              <Reveal key={label}>
                <div className="flex gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-saffron">
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                  <div>
                    <dt className="text-sm text-muted">{label}</dt>
                    <dd className="num text-lg font-medium">{href ? <a href={href} className="hover:text-saffron">{value}</a> : value}</dd>
                  </div>
                </div>
              </Reveal>
            ))}
          </dl>
          <a
            href={`https://www.openstreetmap.org/directions?route=%3B${SITE.lat}%2C${SITE.lng}#map=16/${SITE.lat}/${SITE.lng}`}
            target="_blank"
            rel="noreferrer"
            className="mt-10 inline-flex h-12 items-center gap-2 rounded-full border border-line px-6 font-semibold transition-colors hover:border-saffron/50 hover:text-saffron"
          >
            <Navigation size={18} strokeWidth={1.75} />
            {t.site.contacts.route}
          </a>
        </div>
        <Reveal className="min-h-80">
          <LeafletMap center={{ lat: SITE.lat, lng: SITE.lng }} home={{ lat: SITE.lat, lng: SITE.lng }} zoom={15} className="h-full min-h-80 lg:min-h-[460px]" />
        </Reveal>
      </div>
    </section>
  );
}

// ---------- подвал ----------

function Footer({ name }: { name: string }) {
  const { t } = useI18n();
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-10">
        <SuzaniStrip className="mb-10 block text-saffron/25" />
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <LaganMark size={40} />
            <div>
              <div className="font-display text-lg font-semibold">{name}</div>
              <div className="text-sm text-muted">{t.site.footer.study}</div>
            </div>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            <Link href="/about" className="hover:text-text">
              {t.site.footer.about}
            </Link>
            <Link href="/login" className="hover:text-text">
              {t.site.footer.staff}
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

// ---------- плавающая корзина ----------

function FloatingCart() {
  const { t } = useI18n();
  const cart = useCart();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
    <AnimatePresence>
      {cart.count > 0 && !cart.open && (
        <motion.button
          type="button"
          onClick={() => cart.setOpen(true)}
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 34 }}
          className="pointer-events-auto flex h-14 items-center gap-3 rounded-full bg-saffron pl-5 pr-2 font-semibold text-on-saffron shadow-[0_10px_40px_rgba(0,0,0,0.35),0_0_32px_var(--glow)]"
        >
          <ShoppingBag size={20} strokeWidth={2} />
          {t.site.cart.open} · <span className="num">{cart.count}</span>
          <span className="num rounded-full bg-on-saffron/12 px-4 py-2">{formatMoney(cart.subtotal)}</span>
        </motion.button>
      )}
    </AnimatePresence>
    </div>
  );
}
