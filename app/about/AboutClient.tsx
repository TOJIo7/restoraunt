"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import Lenis from "lenis";
import { motion, useMotionValue, useScroll, useTransform } from "motion/react";
import { Reveal } from "@/components/ui/Reveal";
import { ArrowDown, ArrowRight, ChartColumn, ClipboardList, Package, Users } from "lucide-react";
import { useI18n } from "@/components/Providers";
import { Wordmark } from "@/components/Logo";
import { SuzaniRosette, SuzaniStrip } from "@/components/Ornament";
import { PrefsToggles } from "@/components/shell/PrefsToggles";
import { CountUp } from "@/components/charts/CountUp";
import { use3DSupport } from "@/components/three/support";
import { fmt } from "@/lib/i18n";
import type { TableStatus } from "@/lib/constants";

const AboutScene = dynamic(() => import("@/components/three/AboutScene"), { ssr: false });

type AboutTable = { id: number; number: number; seats: number; x: number; y: number; shape: string; status: TableStatus; share: number };
type Facts = { dishes: number; products: number; staff: number; tables: number };

const MODULES = [
  { key: "orders", icon: ClipboardList, accent: "text-pomegranate" },
  { key: "stock", icon: Package, accent: "text-apricot" },
  { key: "staff", icon: Users, accent: "text-lapis" },
  { key: "reports", icon: ChartColumn, accent: "text-saffron" },
] as const;

export function AboutClient({ loggedIn, facts, tables }: { loggedIn: boolean; facts: Facts; tables: AboutTable[] }) {
  const { t } = useI18n();
  const ok3D = use3DSupport();
  const [slow, setSlow] = useState(false);
  // дробный номер раздела под центром экрана — по нему летит камера
  const progress = useMotionValue(0);
  const { scrollY } = useScroll();
  // параллакс орнамента: фон едет медленнее контента
  const rosetteY = useTransform(scrollY, (v) => v * -0.25);
  const rosette2Y = useTransform(scrollY, (v) => v * -0.12);

  // плавная инерционная прокрутка (кроме «уменьшить движение»)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ autoRaf: true, lerp: 0.09 });
    return () => lenis.destroy();
  }, []);

  useEffect(() => {
    const update = () => {
      const center = window.scrollY + window.innerHeight / 2;
      const els = Array.from(document.querySelectorAll<HTMLElement>("[data-about-section]"));
      const mids = els.map((el) => el.offsetTop + el.offsetHeight / 2);
      if (!mids.length) return;
      let p = 0;
      if (center >= mids[mids.length - 1]) p = mids.length - 1;
      else
        for (let i = 0; i < mids.length - 1; i++) {
          if (center < mids[i + 1]) {
            p = i + Math.max(0, (center - mids[i]) / (mids[i + 1] - mids[i]));
            break;
          }
        }
      progress.set(p);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [progress]);

  const show3D = ok3D === true && !slow;

  return (
    <div className="relative min-h-screen overflow-x-clip">
      {/* фон: орнамент с параллаксом, поверх — 3D-зал */}
      <div className="pointer-events-none fixed inset-0 -z-0" aria-hidden>
        <motion.div style={{ y: rosetteY }} className="absolute -right-40 top-[10vh]">
          <SuzaniRosette size={720} className="text-saffron/[0.07]" />
        </motion.div>
        <motion.div style={{ y: rosette2Y }} className="absolute -left-48 top-[70vh]">
          <SuzaniRosette size={520} className="text-lapis/[0.08]" />
        </motion.div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_65%_45%,var(--glow),transparent_60%)]" />
      </div>
      {show3D && (
        // на узком экране текст идёт поверх зала — 3D приглушаем, чтобы читалось
        <div className="fixed inset-0 z-0 max-lg:opacity-30" aria-hidden>
        <motion.div className="h-full w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
          <AboutScene
            tables={tables}
            progress={progress}
            labels={{ kitchen: t.hall.kitchen, cash: t.hall.cashDesk, entrance: t.hall.entrance }}
            onSlow={() => setSlow(true)}
          />
        </motion.div>
        </div>
      )}

      <header className="fixed inset-x-0 top-0 z-30 border-b border-line/60 bg-bg/70 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-6 lg:px-10">
          <Link href="/">
            <Wordmark name={t.app.name} />
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <PrefsToggles />
            <Link
              href={loggedIn ? "/hall" : "/login"}
              className="hidden h-10 items-center gap-2 rounded-[var(--radius-btn)] bg-saffron px-4 text-sm font-semibold text-on-saffron transition-[filter,transform] hover:brightness-110 active:scale-[0.97] sm:inline-flex"
            >
              {t.about.toApp}
              <ArrowRight size={16} strokeWidth={2} />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1400px] px-6 lg:px-10">
        {/* 0. начало */}
        <section data-about-section className="flex min-h-screen flex-col justify-center pb-16 pt-28 lg:max-w-[46%]">
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-sm font-medium uppercase tracking-[0.2em] text-saffron">
            {t.about.kicker}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
            className="mt-4 font-display text-[clamp(40px,5.4vw,80px)] font-semibold leading-[1.02]"
          >
            {t.app.name}
            <span className="block text-muted">{t.about.title}</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.16 }} className="mt-6 max-w-xl text-lg text-muted">
            {t.about.lead}
          </motion.p>
          <motion.dl initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.24 }} className="mt-10 grid max-w-xl grid-cols-2 gap-x-8 gap-y-5">
            {(["dishes", "products", "staff", "tables"] as const).map((k) => (
              <div key={k} className="border-l-2 border-saffron/40 pl-4">
                <dt className="sr-only">{fmt(t.about.facts[k], { n: facts[k] })}</dt>
                <dd>
                  <CountUp value={facts[k]} money={false} className="num block font-display text-4xl font-semibold" />
                  <span className="text-sm text-muted">{fmt(t.about.facts[k], { n: facts[k] }).replace(/^\d+\s*/, "")}</span>
                </dd>
              </div>
            ))}
          </motion.dl>
          <div className="mt-14 flex items-center gap-2 text-sm text-muted">
            <ArrowDown size={16} strokeWidth={1.75} className="motion-safe:animate-bounce" />
            {t.about.scroll}
          </div>
        </section>

        {/* 1–4. модули */}
        {MODULES.map((m, i) => (
          <ModuleSection key={m.key} index={i + 1} m={m} />
        ))}

        {/* 5. финал */}
        <section data-about-section className="flex min-h-[110vh] flex-col justify-center py-24 lg:max-w-[46%]">
          <Reveal delay={0.1}>
            <h2 className="font-display text-[clamp(30px,3.6vw,52px)] font-semibold leading-tight">{t.about.finalTitle}</h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-4 max-w-lg text-lg text-muted">{t.about.finalText}</p>
          </Reveal>
          <Reveal delay={0.22}>
            <Link
              href={loggedIn ? "/hall" : "/login"}
              className="mt-10 inline-flex h-14 items-center gap-2.5 rounded-[var(--radius-btn)] bg-saffron px-6 font-semibold text-on-saffron shadow-[0_0_24px_var(--glow)] transition-[filter,transform] hover:brightness-110 active:scale-[0.97]"
            >
              {t.about.toApp}
              <ArrowRight size={18} strokeWidth={2} />
            </Link>
          </Reveal>
          <SuzaniStrip className="mt-16 block text-saffron/30" />
        </section>
      </main>
    </div>
  );
}

function ModuleSection({ index, m }: { index: number; m: (typeof MODULES)[number] }) {
  const { t } = useI18n();
  const d = t.about[m.key];
  const local = useRef<HTMLElement | null>(null);
  // заголовок «прилипает» и уменьшается, пока раздел прокручивается
  const { scrollYProgress } = useScroll({ target: local, offset: ["start start", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 0.45], [1, 0.78]);
  const Icon = m.icon;

  return (
    <section
      ref={local}
      data-about-section
      className="relative min-h-[130vh] py-[20vh] lg:max-w-[42%]"
    >
      <div className="sticky top-24 z-10">
      <motion.div style={{ scale }} className="origin-top-left">
        <div className="flex items-center gap-3">
          <span className="num font-display text-6xl font-semibold text-line">{String(index).padStart(2, "0")}</span>
          <Icon size={28} strokeWidth={1.6} className={m.accent} />
        </div>
        <h2 className="mt-2 font-display text-[clamp(32px,3.6vw,54px)] font-semibold leading-tight">{d.title}</h2>
      </motion.div>
      <div className="mt-8 rounded-[var(--radius-card)] border border-line bg-surface/85 p-6 backdrop-blur-[2px]">
        <Reveal>
          <p className="text-lg leading-relaxed text-muted">{d.text}</p>
        </Reveal>
        <ul className="mt-6 flex flex-col gap-3">
          {(["a", "b", "c"] as const).map((k, i) => (
            <Reveal key={k} as="li" delay={0.06 * (i + 1)}>
              <span className="flex items-start gap-3">
                <span className={`mt-2 h-2 w-2 shrink-0 rotate-45 bg-current ${m.accent}`} />
                <span>{d.points[k]}</span>
              </span>
            </Reveal>
          ))}
        </ul>
      </div>
      </div>
    </section>
  );
}
