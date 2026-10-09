import "server-only";

import type { Workspace } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";

export type InvoiceComplianceStatus = {
  missingRcs: boolean;
  missingBusinessPermit: boolean;
};

function missing(value: string | null | undefined) {
  return !value || value.trim().length === 0;
}

/** Signed URL of the establishment-authorisation barcode printed on invoices, if uploaded. */
export async function getEstablishmentBarcodeUrl(workspace: Workspace): Promise<string | null> {
  const path = workspace.company?.establishment_barcode_path;
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("company-documents").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function getInvoiceComplianceStatus(workspace: Workspace): Promise<InvoiceComplianceStatus> {
  const company = workspace.company;
  if (!company) return { missingRcs: false, missingBusinessPermit: false };

  if (company.entity_kind !== "independent") {
    return {
      missingRcs: missing(company.rcs_number),
      missingBusinessPermit: missing(company.business_permit_number),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("independent_activity_profiles")
    .select("rcs_registered,business_permit_held")
    .eq("company_id", company.id)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return {
    missingRcs: Boolean(data?.rcs_registered) && missing(company.rcs_number),
    missingBusinessPermit: Boolean(data?.business_permit_held) && missing(company.business_permit_number),
  };
}
