"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export type TransactionActionState = {
  status: "idle" | "success" | "error";
  message: string;
  journalEntryId?: string;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function createSourceTransaction(
  _previous: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const workspace = await getWorkspace();
  if (!workspace.authenticated || !workspace.userId || !workspace.organization || !workspace.company) {
    return { status: "error", message: "Your session expired. Please sign in again." };
  }

  const occurredOn = String(formData.get("occurred_on") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const gross = Number(formData.get("amount_gross"));
  const vat = Number(formData.get("vat_amount") || 0);
  const counterparty = String(formData.get("counterparty_name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) return { status: "error", message: "Choose a valid transaction date." };
  if (!["income", "expense"].includes(direction)) return { status: "error", message: "Choose income or expense." };
  if (!Number.isFinite(gross) || gross <= 0) return { status: "error", message: "Gross amount must be greater than zero." };
  if (!Number.isFinite(vat) || vat < 0 || vat > gross) return { status: "error", message: "VAT must be between zero and the gross amount." };

  const amountGross = roundMoney(gross);
  const vatAmount = roundMoney(vat);
  const amountNet = roundMoney(amountGross - vatAmount);
  const supabase = await createClient();
  const { error } = await supabase.from("source_transactions").insert({
    organization_id: workspace.organization.id,
    company_id: workspace.company.id,
    occurred_on: occurredOn,
    direction,
    amount_gross: amountGross,
    amount_net: amountNet,
    vat_amount: vatAmount,
    currency: workspace.company.base_currency || "EUR",
    counterparty_name: counterparty || null,
    description: description || null,
    source_type: "manual",
    classification_status: "review",
    created_by: workspace.userId,
  });

  if (error) return { status: "error", message: error.message };

  revalidatePath("/app");
  revalidatePath("/app/transactions");
  return { status: "success", message: "Transaction recorded. It is ready for accounting review." };
}

export async function postSourceTransaction(
  _previous: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const workspace = await getWorkspace();
  if (!workspace.authenticated || !workspace.company) return { status: "error", message: "Your session expired. Please sign in again." };

  const sourceTransactionId = String(formData.get("source_transaction_id") ?? "").trim();
  const accountCode = String(formData.get("account_code") ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sourceTransactionId)) {
    return { status: "error", message: "The transaction reference is invalid." };
  }
  if (!/^\d{3,6}$/.test(accountCode)) return { status: "error", message: "Choose a valid accounting category." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("classify_and_post_source_transaction", {
    p_source_transaction_id: sourceTransactionId,
    p_account_code: accountCode,
  });
  if (error) return { status: "error", message: error.message };

  revalidatePath("/app");
  revalidatePath("/app/transactions");
  revalidatePath("/app/accounting");
  return {
    status: "success",
    message: "Posted successfully. The journal entry is now immutable.",
    journalEntryId: typeof data === "string" ? data : undefined,
  };
}
