import { requireSession } from "@/lib/session";
import { ComingSoon } from "@/components/shell/ComingSoon";

export default async function Page() {
  await requireSession(["OWNER"]);
  return <ComingSoon section="settings" stage={1} />;
}
