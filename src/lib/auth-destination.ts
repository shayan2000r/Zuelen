import "server-only";

import { chooseContextDestination } from "@/lib/context-destination";
import { safeInternalDestination } from "@/lib/safe-navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export { safeInternalDestination } from "@/lib/safe-navigation";

export async function resolveAuthenticatedDestination(explicitNext?: string | null) {
  const next = safeInternalDestination(explicitNext);
  if (next) return next;
  const workspace = await getWorkspace();
  if (!workspace.authenticated || !workspace.userId) return "/sign-in";
  const supabase = await createClient();
  const { data: professional } = await supabase.from("accountant_profiles").select("id").eq("user_id", workspace.userId).maybeSingle();
  return chooseContextDestination({
    hasActiveEconomicWorkspace:Boolean(workspace.company),
    economicWorkspaceCount:workspace.workspaces.length,
    hasProfessionalProfile:Boolean(professional),
  });
}
