import { redirect } from "next/navigation";
import { CopilotPanel } from "@/components/copilot-panel";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function CopilotPage({ searchParams }: { searchParams: Promise<{ prompt?: string }> }) {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in");
  if (!workspace.company) redirect("/setup");
  const params = await searchParams;
  return <CopilotPanel initialQuestion={params.prompt ?? ""} />;
}
