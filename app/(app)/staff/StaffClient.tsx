"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Info } from "lucide-react";
import { useI18n } from "@/components/Providers";
import { PageHeader } from "@/components/shell/PageHeader";
import { fmt } from "@/lib/i18n";
import { Team, type Member } from "./Team";
import { Schedule, type ShiftRow } from "./Schedule";
import { Attendance, type AttendanceData } from "./Attendance";
import { Payroll, type AdjustmentRow } from "./Payroll";
import { WaiterSales, type SalesRow } from "./WaiterSales";
import type { PayrollRow } from "@/lib/payroll";

export type StaffTab = "team" | "schedule" | "attendance" | "payroll" | "sales";

export function StaffClient(
  props: {
    tab: StaffTab;
    tabs: StaffTab[];
    isOwner: boolean;
    team: Member[];
    weekStart?: string;
    shifts?: ShiftRow[];
    month?: string;
    payroll?: PayrollRow[];
    adjustments?: AdjustmentRow[];
    period?: string;
    from?: string;
    to?: string;
    sales?: SalesRow[];
  } & Partial<AttendanceData>,
) {
  const { t } = useI18n();
  const { tab, tabs, isOwner, team } = props;
  return (
    <>
      <PageHeader title={t.nav.staff} subtitle={fmt(t.staff.count, { n: team.length })} />
      {!isOwner && (
        <p className="mb-5 flex items-center gap-2 text-sm text-muted">
          <Info size={16} strokeWidth={1.75} className="text-lapis" />
          {t.staff.cashierHint}
        </p>
      )}
      <nav className="no-scrollbar mb-6 flex gap-1.5 overflow-x-auto">
        {tabs.map((id) => (
          <Link
            key={id}
            href={`/staff?tab=${id}`}
            className={`relative inline-flex h-12 shrink-0 items-center rounded-[var(--radius-btn)] px-4 text-[15px] font-medium transition-colors ${
              tab === id ? "text-text" : "text-muted hover:bg-surface-2 hover:text-text"
            }`}
          >
            {tab === id && <motion.span layoutId="staff-tab" className="absolute inset-0 rounded-[var(--radius-btn)] border border-saffron/35 bg-saffron/10" />}
            <span className="relative">{t.staff.tabs[id]}</span>
          </Link>
        ))}
      </nav>

      {tab === "team" && <Team team={team} isOwner={isOwner} />}
      {tab === "schedule" && <Schedule team={team} weekStart={props.weekStart!} shifts={props.shifts ?? []} isOwner={isOwner} />}
      {tab === "attendance" && <Attendance team={team} todayShifts={props.todayShifts ?? []} open={props.open ?? []} log={props.log ?? []} />}
      {tab === "payroll" && <Payroll month={props.month!} rows={props.payroll ?? []} adjustments={props.adjustments ?? []} />}
      {tab === "sales" && <WaiterSales period={props.period!} from={props.from!} to={props.to!} rows={props.sales ?? []} />}
    </>
  );
}
