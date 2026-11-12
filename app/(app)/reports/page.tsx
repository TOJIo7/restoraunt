import { requireSession } from "@/lib/session";
import { getReport } from "@/lib/reports";
import { addDays, PERIODS, periodRange, ymd, type Period } from "@/lib/period";
import { ReportsClient, type ReportTab } from "./ReportsClient";

const TABS: ReportTab[] = ["summary", "dishes", "expenses", "profit", "stock"];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string; period?: string; from?: string; to?: string }> }) {
  await requireSession(["OWNER"]);
  const sp = await searchParams;
  const tab: ReportTab = TABS.includes(sp.tab as ReportTab) ? (sp.tab as ReportTab) : "summary";
  const period: Period = PERIODS.includes(sp.period as Period) ? (sp.period as Period) : "today";
  const { from, to } = periodRange(period, sp.from, sp.to);
  const report = await getReport(from, to);
  return <ReportsClient tab={tab} period={period} from={ymd(from)} to={ymd(addDays(to, -1))} report={report} />;
}
