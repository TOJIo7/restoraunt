"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  LayoutGrid,
  ClipboardList,
  CalendarDays,
  Wallet,
  UtensilsCrossed,
  Package,
  Users,
  ChartColumn,
  Settings,
  LogOut,
} from "lucide-react";
import type { Role } from "@/lib/constants";
import type { Dict } from "@/lib/i18n";
import { useI18n } from "@/components/Providers";
import { Wordmark } from "@/components/Logo";
import { logout } from "@/app/actions/auth";

type NavKey = keyof Dict["nav"];

export const NAV: { href: string; key: NavKey; icon: typeof LayoutGrid; roles: Role[] }[] = [
  { href: "/hall", key: "hall", icon: LayoutGrid, roles: ["OWNER", "CASHIER"] },
  { href: "/orders", key: "orders", icon: ClipboardList, roles: ["OWNER", "CASHIER"] },
  { href: "/reservations", key: "reservations", icon: CalendarDays, roles: ["OWNER", "CASHIER"] },
  { href: "/cash", key: "cash", icon: Wallet, roles: ["OWNER", "CASHIER"] },
  { href: "/menu", key: "menu", icon: UtensilsCrossed, roles: ["OWNER", "CASHIER"] },
  { href: "/stock", key: "stock", icon: Package, roles: ["OWNER", "CASHIER"] },
  { href: "/staff", key: "staff", icon: Users, roles: ["OWNER", "CASHIER"] },
  { href: "/reports", key: "reports", icon: ChartColumn, roles: ["OWNER"] },
  { href: "/settings", key: "settings", icon: Settings, roles: ["OWNER"] },
];

export function Sidebar({ role, userName, badges = {} }: { role: Role; userName: string; badges?: Partial<Record<NavKey, number>> }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const items = NAV.filter((n) => n.roles.includes(role));

  return (
    <aside className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="px-5 pb-6 pt-6">
        <Wordmark name={t.app.name} tagline={t.app.tagline} />
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
        {items.map(({ href, key, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex h-12 items-center gap-3 rounded-[var(--radius-btn)] px-3 text-[15px] font-medium transition-colors ${
                active ? "text-text" : "text-muted hover:bg-surface-2 hover:text-text"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-[var(--radius-btn)] border border-saffron/30 bg-saffron/10"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <Icon size={20} strokeWidth={1.75} className={`relative ${active ? "text-saffron" : ""}`} />
              <span className="relative">{t.nav[key]}</span>
              {!!badges[key] && (
                <span className="num relative ml-auto rounded-full bg-apricot/18 px-2 py-0.5 text-xs font-semibold text-apricot" title={t.stock.low}>
                  {badges[key]}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line p-3">
        <div className="mb-2 px-3 pt-1">
          <div className="truncate text-sm font-semibold">{userName}</div>
          <div className="text-xs text-muted">{t.roles[role]}</div>
        </div>
        <form action={() => logout("manual")}>
          <button
            type="submit"
            className="flex h-11 w-full items-center gap-3 rounded-[var(--radius-btn)] px-3 text-sm text-muted transition-colors hover:bg-pomegranate/10 hover:text-pomegranate"
          >
            <LogOut size={18} strokeWidth={1.75} />
            {t.common.logout}
          </button>
        </form>
      </div>
    </aside>
  );
}
