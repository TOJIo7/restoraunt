import { requireSession } from "@/lib/session";
import { ComingSoon } from "@/components/shell/ComingSoon";

export default async function Page() {
  await requireSession();
  return <ComingSoon section="menu" stage={1} />;
}
