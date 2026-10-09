"use server";

import { revalidatePath } from "next/cache";
import { hasPremiumAccess } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { userFacingDataError } from "@/lib/user-facing-error";
import { VAT_FORM_SOURCES } from "@/lib/vat-return/forms";
import { loadVatReturn } from "@/lib/vat-return/load";
import { parseVatPeriod } from "@/lib/vat-return/periods";

export type VatFilingState = {
  status: "idle" | "success" | "error";
  message: string;
  filingId?: string;
  upgradeRequired?: boolean;
};
export async function prepareVatFilingAction(_previous: VatFilingState, formData: FormData): Promise<VatFilingState> {
  const w = await getWorkspace();
  if (!w.authenticated || !w.company || !w.organization || !w.capabilities?.hasVat)
    return { status: "error", message: "VAT is not configured for the active workspace." };
  if (!(await hasPremiumAccess(w.organization.id)))
    return {
      status: "error",
      upgradeRequired: true,
      message:
        w.profile?.locale === "fr"
          ? "Votre position TVA reste visible avec Basic. La préparation d’une déclaration TVA figée est incluse avec Premium."
          : "Your VAT position remains visible on Basic. Preparing a frozen VAT filing is included with Premium.",
    };
  const period = parseVatPeriod(String(formData.get("period") ?? ""));
  if (!period) return { status: "error", message: "Choose a valid VAT period." };
  const s = await createClient();
  const { data, error } = await s.rpc("prepare_vat_filing", {
    p_company_id: w.company.id,
    p_period_start: period.start,
    p_period_end: period.end,
  });
  if (error) return { status: "error", message: userFacingDataError(error) };
  // Freeze the return boxes with the ledger snapshot the database just took.
  const filingId = typeof data === "string" ? data : undefined;
  if (filingId) {
    const vatReturn = await loadVatReturn(s, w.company, period);
    const { data: filing } = await s.from("filings").select("payload").eq("id", filingId).maybeSingle();
    await s
      .from("filings")
      .update({
        payload: {
          ...((filing?.payload as Record<string, unknown>) ?? {}),
          form: `TVA_${period.form}`,
          form_version: VAT_FORM_SOURCES[period.form].version,
          boxes: vatReturn.boxes,
          issues: vatReturn.issues,
          ledger: vatReturn.ledger,
          reconciled: vatReturn.reconciled,
        },
      })
      .eq("id", filingId);
  }
  for (const p of ["/app", "/app/vat", "/app/taxes", "/app/compliance"]) revalidatePath(p);
  return {
    status: "success",
    message:
      w.profile?.locale === "fr"
        ? "Déclaration figée : cases et écritures enregistrées. Déposez-la sur eCDF / MyGuichet."
        : "Return frozen: boxes and entries saved. File it on eCDF / MyGuichet.",
    filingId,
  };
}
