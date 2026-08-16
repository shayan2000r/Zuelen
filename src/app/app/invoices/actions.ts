"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export type InvoiceActionState = {
  status: "idle" | "success" | "error";
  message: string;
  invoiceId: string | null;
};

export const initialInvoiceState: InvoiceActionState = { status: "idle", message: "", invoiceId: null };

export async function createAndIssueInvoice(
  _previous: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const workspace = await getWorkspace();
  if (!workspace.authenticated || !workspace.company) {
    return { status: "error", message: "Your session expired. Please sign in again.", invoiceId: null };
  }

  const customerName = String(formData.get("customer_name") ?? "").trim();
  const customerEmail = String(formData.get("customer_email") ?? "").trim();
  const customerCountry = String(formData.get("customer_country") ?? "LU").trim().toUpperCase();
  const customerVat = String(formData.get("customer_vat_number") ?? "").trim();
  const issueDate = String(formData.get("issue_date") ?? "");
  const serviceDate = String(formData.get("service_date") ?? "");
  const dueDate = String(formData.get("due_date") ?? "");
  const vatTreatment = String(formData.get("vat_treatment") ?? "domestic");
  const street = String(formData.get("customer_street") ?? "").trim();
  const postalCode = String(formData.get("customer_postal_code") ?? "").trim();
  const city = String(formData.get("customer_city") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!customerName || !street || !postalCode || !city) {
    return { status: "error", message: "Customer name and full billing address are required.", invoiceId: null };
  }
  if (!/^[A-Z]{2}$/.test(customerCountry)) {
    return { status: "error", message: "Use a two-letter country code such as LU, FR or DE.", invoiceId: null };
  }
  if (![issueDate, serviceDate, dueDate].every((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))) {
    return { status: "error", message: "Invoice, service and due dates are required.", invoiceId: null };
  }
  if (!["domestic", "eu_b2b_reverse_charge"].includes(vatTreatment)) {
    return { status: "error", message: "Unsupported VAT treatment.", invoiceId: null };
  }

  let lines: unknown;
  try {
    lines = JSON.parse(String(formData.get("lines_json") ?? "[]"));
  } catch {
    return { status: "error", message: "The invoice lines could not be read.", invoiceId: null };
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    return { status: "error", message: "Add at least one invoice line.", invoiceId: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_and_issue_service_invoice", {
    p_company_id: workspace.company.id,
    p_customer_name: customerName,
    p_customer_email: customerEmail || null,
    p_customer_country: customerCountry,
    p_customer_vat_number: customerVat || null,
    p_customer_address: { street, postal_code: postalCode, city, country_code: customerCountry },
    p_issue_date: issueDate,
    p_service_date: serviceDate,
    p_due_date: dueDate,
    p_vat_treatment: vatTreatment,
    p_lines: lines,
    p_notes: notes || null,
  });

  if (error) return { status: "error", message: error.message, invoiceId: null };
  const invoiceId = typeof data === "string" ? data : null;
  if (!invoiceId) return { status: "error", message: "The invoice was created but no invoice ID was returned.", invoiceId: null };

  revalidatePath("/app");
  revalidatePath("/app/invoices");
  revalidatePath("/app/accounting");
  return { status: "success", message: "Invoice issued and posted to the ledger.", invoiceId };
}
