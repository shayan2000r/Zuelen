import { redirect } from "next/navigation";
import { CompanySetup } from "@/components/company-setup";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in");
  if (workspace.company) redirect("/app");
  return <CompanySetup />;
}
