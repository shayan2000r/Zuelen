import { redirect } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ProtectedAppLayout({ children }: { children: React.ReactNode }) {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in");
  if (!workspace.organization || !workspace.company) redirect("/setup");

  const fiscalYear = new Date().getFullYear();

  return (
    <AppFrame
      companyName={workspace.company.legal_name}
      fiscalYear={fiscalYear}
      email={workspace.email}
    >
      {children}
    </AppFrame>
  );
}
