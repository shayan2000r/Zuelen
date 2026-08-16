"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export type TransactionActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialTransactionState: TransactionActionState = { status: "idle", message: "" };

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

  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
    return { status: "error", message: "Choose a valid transaction date." };
  }
  if (!['income', 'expense'].includes(direction)) {
    return { status: "error", message: "Choose income or expense." };
  }
  if (!Number.isFinite(gross) || gross <= 0) {
    return { status: "error", message: "Gross amount must be greater than zero." };
  }
  if (!Number.isFinite(vat) || vat < 0 || vat > gross) {
    return { status: "error", message: "VAT must be between zero and the gross amount." };
  }

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
