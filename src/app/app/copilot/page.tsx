import { redirect } from "next/navigation";
import { CopilotPanel } from "@/components/copilot-panel";
import { getWorkspace } from "@/lib/workspace";
export const dynamic="force-dynamic";
export default async function CopilotPage(){const w=await getWorkspace();if(!w.authenticated)redirect("/sign-in");if(!w.company)redirect("/setup");return <CopilotPanel/>}
