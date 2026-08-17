"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export type BankImportState = {
  status: "idle" | "success" | "error";
  message: string;
  imported?: number;
  duplicates?: number;
};

export async function importBankRows(
  _previous: BankImportState,
  formData: FormData,
): Promise<BankImportState> {
  const workspace = await getWorkspace();
  if (!workspace.authenticated || !workspace.company) {
    return { status: "error", message: "Your session expired. Please sign in again." };
  }

  const accountName = String(formData.get("account_name") ?? "").trim();
  const iban = String(formData.get("iban") ?? "").trim().replace(/\s+/g, "").toUpperCase();
  const currency = String(formData.get("currency") ?? workspace.company.base_currency ?? "EUR").trim().toUpperCase();
  const fileName = String(formData.get("file_name") ?? "bank-import.csv").trim();
  const rowsJson = String(formData.get("rows_json") ?? "[]");

  if (!accountName && !iban) return { status: "error", message: "Give this bank account a name or enter its IBAN." };
  if (!/^[A-Z]{3}$/.test(currency)) return { status: "error", message: "Use a three-letter currency such as EUR." };

  let rows: unknown;
  try { rows = JSON.parse(rowsJson); } catch { return { status: "error", message: "The normalized CSV rows could not be read." }; }
  if (!Array.isArray(rows) || rows.length === 0) return { status: "error", message: "No valid bank rows were found in this file." };
  if (rows.length > 2500) return { status: "error", message: "Import up to 2,500 bank rows at a time." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_bank_rows", {
    p_company_id: workspace.company.id,
    p_account_name: accountName || "Main bank account",
    p_iban: iban || null,
    p_currency: currency,
    p_file_name: fileName || null,
    p_rows: rows,
  });

  if (error) return { status: "error", message: error.message };
  const result = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const imported = Number(result.imported ?? 0);
  const duplicates = Number(result.duplicates ?? 0);

  revalidatePath("/app");
  revalidatePath("/app/banking");
  revalidatePath("/app/transactions");
  return {
    status: "success",
    message: `${imported} bank transaction${imported === 1 ? "" : "s"} imported${duplicates ? ` · ${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped` : ""}.`,
    imported,
    duplicates,
  };
}
