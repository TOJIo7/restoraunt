import { getDict } from "@/lib/i18n/server";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SuzaniStrip } from "@/components/Ornament";
import { LoginArt } from "./LoginArt";
import { Wordmark } from "@/components/Logo";
import { PrefsToggles } from "@/components/shell/PrefsToggles";
import { PinPad } from "./PinPad";

export default async function LoginPage() {
  const { t } = await getDict();
  return (
    <main className="relative grid min-h-screen grid-cols-1 overflow-hidden lg:grid-cols-[1.1fr_1fr]">
      {/* Левая часть: 3D-чайник на лягане (или орнамент, если 3D нельзя) */}
      <section className="relative hidden items-center justify-center overflow-hidden border-r border-line bg-surface lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,var(--glow),transparent_60%)]" />
        <LoginArt />
        <Link
          href="/about"
          className="absolute right-6 top-6 z-10 inline-flex h-10 items-center gap-2 rounded-[var(--radius-btn)] border border-line bg-surface/80 px-4 text-sm text-muted transition-colors hover:border-saffron/40 hover:text-saffron"
        >
          {t.login.about}
          <ArrowRight size={16} strokeWidth={1.75} />
        </Link>
        <div className="pointer-events-none absolute bottom-10 left-10 right-10">
          <SuzaniStrip className="mb-6 text-line" />
          <Link href="/" className="pointer-events-auto inline-block">
            <Wordmark name={t.app.name} tagline={t.app.tagline} />
          </Link>
        </div>
      </section>

      <section className="relative flex flex-col items-center justify-center px-6 py-10">
        <div className="absolute right-6 top-6">
          <PrefsToggles />
        </div>
        <Link href="/" className="mb-8 lg:hidden">
          <Wordmark name={t.app.name} tagline={t.app.tagline} />
        </Link>
        <PinPad />
      </section>
    </main>
  );
}
