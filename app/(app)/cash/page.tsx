import { requireSession } from "@/lib/session";
import { ComingSoon } from "@/components/shell/ComingSoon";

export default async function Page() {
  await requireSession();
  return <ComingSoon section="cash" stage={2} />;
}
