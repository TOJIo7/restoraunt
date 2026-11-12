import { getDict } from "@/lib/i18n/server";
import { SuzaniRosette, SuzaniStrip } from "@/components/Ornament";
import { Wordmark } from "@/components/Logo";
import { PrefsToggles } from "@/components/shell/PrefsToggles";
import { PinPad } from "./PinPad";

export default async function LoginPage() {
  const { t } = await getDict();
  return (
    <main className="relative grid min-h-screen grid-cols-1 overflow-hidden lg:grid-cols-[1.1fr_1fr]">
      {/* Левая часть: декор. На этапе 7 здесь будет 3D-чайник. */}
      <section className="relative hidden items-center justify-center border-r border-line bg-surface lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,var(--glow),transparent_60%)]" />
        <SuzaniRosette size={460} className="relative text-saffron/45 motion-safe:animate-[spin_120s_linear_infinite]" />
        <div className="absolute bottom-10 left-10 right-10">
          <SuzaniStrip className="mb-6 text-line" />
          <Wordmark name={t.app.name} tagline={t.app.tagline} />
        </div>
      </section>

      <section className="relative flex flex-col items-center justify-center px-6 py-10">
        <div className="absolute right-6 top-6">
          <PrefsToggles />
        </div>
        <div className="mb-8 lg:hidden">
          <Wordmark name={t.app.name} tagline={t.app.tagline} />
        </div>
        <PinPad />
      </section>
    </main>
  );
}
