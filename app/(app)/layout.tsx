import { requireSession } from "@/lib/session";
import { idleMsFor } from "@/lib/session-token";
import { Sidebar } from "@/components/shell/Sidebar";
import { PrefsToggles } from "@/components/shell/PrefsToggles";
import { IdleLogout } from "@/components/shell/IdleLogout";
import { SuzaniStrip } from "@/components/Ornament";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="flex min-h-screen">
      <Sidebar role={session.role} userName={session.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-sm">
          <div className="flex h-16 items-center justify-end gap-3 px-8">
            <PrefsToggles />
          </div>
          <SuzaniStrip className="block text-saffron/25" />
        </header>
        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
      <IdleLogout idleMs={idleMsFor(session.role)} />
    </div>
  );
}
