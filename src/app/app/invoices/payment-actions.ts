"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export type PaymentActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function recordInvoicePaymentAction(
  _previous: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const workspace = await getWorkspace();
  if (!workspace.authenticated || !workspace.company) return { status: "error", message: "Your session expired. Please sign in again." };

  const invoiceId = String(formData.get("invoice_id") ?? "");
  const amount = Number(formData.get("amount"));
  const paidOn = String(formData.get("paid_on") ?? "");
  const bankTransactionId = String(formData.get("bank_transaction_id") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();

  if (!/^[0-9a-f-]{36}$/i.test(invoiceId)) return { status: "error", message: "Invoice reference is invalid." };
  if (!Number.isFinite(amount) || amount <= 0) return { status: "error", message: "Payment amount must be greater than zero." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) return { status: "error", message: "Choose a valid payment date." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_invoice_payment", {
    p_invoice_id: invoiceId,
    p_amount: amount,
    p_paid_on: paidOn,
    p_bank_transaction_id: bankTransactionId || null,
    p_reference: reference || null,
  });
  if (error) return { status: "error", message: error.message };

  revalidatePath("/app");
  revalidatePath("/app/invoices");
  revalidatePath(`/app/invoices/${invoiceId}`);
  revalidatePath("/app/accounting");
  return { status: "success", message: bankTransactionId ? "Bank payment matched and posted." : "Payment recorded and posted to the ledger." };
}
