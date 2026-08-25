import { redirect } from "next/navigation";
import { IndependentSetup } from "@/components/independent-setup";
import { normalizeLocale } from "@/lib/i18n";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function IndependentSetupPage() {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in?next=/setup/independent");
  return <IndependentSetup locale={normalizeLocale(workspace.profile?.locale)} year={new Date().getFullYear()} defaultName={workspace.profile?.full_name ?? ""}/>;
}
