"use server";

import { askCopilot, type CopilotState } from "@/app/app/copilot/actions";
import { hasPremiumAccess } from "@/lib/billing";
import { normalizeLocale } from "@/lib/i18n";
import { getWorkspace } from "@/lib/workspace";

export type GatedCopilotState = CopilotState & { upgradeRequired?: boolean };

export async function askGatedCopilot(previous: GatedCopilotState, formData: FormData): Promise<GatedCopilotState> {
  const workspace = await getWorkspace();
  const locale = normalizeLocale(workspace.profile?.locale);
  const fr = locale === "fr";

  if (!workspace.authenticated || !workspace.organization) {
    return { status: "error", message: fr ? "Votre session a expiré." : "Your session expired." };
  }

  if (!(await hasPremiumAccess(workspace.organization.id))) {
    return {
      status: "error",
      upgradeRequired: true,
      message: fr
        ? "Zuelen Copilot est inclus avec Premium. Votre question est prête — passez à Premium pour obtenir une réponse contextualisée à partir de vos données."
        : "Zuelen Copilot is included with Premium. Your question is ready — upgrade to receive a workspace-aware answer from your data.",
    };
  }

  return askCopilot(previous, formData);
}
