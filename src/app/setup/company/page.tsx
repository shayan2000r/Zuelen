import { redirect } from "next/navigation";
import { CompanySetup } from "@/components/company-setup";
import { normalizeLocale } from "@/lib/i18n";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function CompanySetupPage() {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in?next=/setup/company");
  return <CompanySetup locale={normalizeLocale(workspace.profile?.locale)}/>;
}
