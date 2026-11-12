import { getDict } from "@/lib/i18n/server";
import { fmt, type Dict } from "@/lib/i18n";
import { EmptyState } from "@/components/Ornament";
import { PageHeader } from "./PageHeader";

/** Заглушка раздела, который появится на следующих этапах роадмапа. */
export async function ComingSoon({ section, stage }: { section: keyof Dict["placeholder"]; stage: number }) {
  const { t } = await getDict();
  return (
    <>
      <PageHeader title={t.nav[section]} />
      <EmptyState badge={fmt(t.common.stage, { n: stage })} title={t.common.soon} text={t.placeholder[section]} />
    </>
  );
}
