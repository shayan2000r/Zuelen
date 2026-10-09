import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeVatReturn, type VatCompanyProfile, type VatPurchase, type VatSale } from "./compute";
import type { VatPeriod } from "./periods";

type Company = {
  id: string;
  vat_registered: boolean | null;
  vat_exemption_basis?: string | null;
  vat_deduction_mode?: string | null;
  vat_deduction_ratio?: number | string | null;
};

function cents(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function vatCompanyProfile(company: Company): VatCompanyProfile {
  const basis = company.vat_exemption_basis;
  const mode = company.vat_deduction_mode;
  return {
    vatRegistered: Boolean(company.vat_registered),
    exemptionBasis: basis === "franchise" || basis === "exempt_activity" ? basis : null,
    deductionMode: mode === "partial" || mode === "none" ? mode : "full",
    deductionRatio: company.vat_deduction_ratio == null ? null : Number(company.vat_deduction_ratio),
  };
}

/**
 * Builds the VAT return of a period from issued invoices and posted transactions, and the VAT ledger balances
 * (461411 output, 421611 input) the return is checked against.
 */
export async function loadVatReturn(supabase: SupabaseClient, company: Company, period: VatPeriod) {
  const [{ data: invoices }, { data: transactions }, { data: accounts }, { data: entries }] = await Promise.all([
    supabase
      .from("sales_invoices")
      .select("id,invoice_number,vat_treatment,service_date,exchange_rate_to_base,customer_snapshot")
      .eq("company_id", company.id)
      .eq("status", "issued")
      .gte("service_date", period.start)
      .lte("service_date", period.end),
    supabase
      .from("source_transactions")
      .select(
        "id,occurred_on,direction,amount_gross,amount_net,vat_amount,vat_rate,vat_treatment,counterparty_country,counterparty_name,description,exchange_rate_to_base,suggested_account_id,source_type",
      )
      .eq("company_id", company.id)
      .eq("classification_status", "posted")
      .neq("source_type", "invoice")
      .gte("occurred_on", period.start)
      .lte("occurred_on", period.end),
    supabase.from("company_accounts").select("id,code,account_type").eq("company_id", company.id),
    supabase
      .from("journal_entries")
      .select("id")
      .eq("company_id", company.id)
      .eq("status", "posted")
      .gte("entry_date", period.start)
      .lte("entry_date", period.end),
  ]);
  const accountById = new Map((accounts ?? []).map(a => [a.id as string, a as { code: string; account_type: string }]));

  const sales: VatSale[] = [];
  const purchases: VatPurchase[] = [];
  const invoiceIds = (invoices ?? []).map(i => i.id as string);
  if (invoiceIds.length) {
    const { data: lines } = await supabase
      .from("sales_invoice_lines")
      .select("id,invoice_id,vat_rate,net_amount,vat_amount,revenue_account_code")
      .in("invoice_id", invoiceIds);
    const invoiceById = new Map((invoices ?? []).map(i => [i.id as string, i]));
    for (const line of lines ?? []) {
      const invoice = invoiceById.get(line.invoice_id as string)!;
      const fx = Number(invoice.exchange_rate_to_base ?? 1) || 1;
      const snapshot = (invoice.customer_snapshot ?? {}) as { country_code?: string; name?: string };
      sales.push({
        id: line.id as string,
        source: "invoice",
        label: `${invoice.invoice_number ?? "Invoice"} · ${snapshot.name ?? ""}`.trim(),
        date: invoice.service_date as string,
        treatment: invoice.vat_treatment as string,
        country: snapshot.country_code?.toUpperCase() ?? null,
        rate: Number(line.vat_rate),
        base: cents(Number(line.net_amount) * fx),
        vat: cents(Number(line.vat_amount) * fx),
        accountCode: (line.revenue_account_code as string) ?? null,
      });
    }
  }

  for (const t of transactions ?? []) {
    const account = t.suggested_account_id ? accountById.get(t.suggested_account_id as string) : undefined;
    if (!account || account.account_type === "asset" || account.account_type === "liability") continue;
    const fx = Number(t.exchange_rate_to_base ?? 1) || 1;
    const gross = Number(t.amount_gross),
      vat = Number(t.vat_amount ?? 0),
      selfAssessed =
        t.direction === "expense" &&
        (t.vat_treatment === "eu_b2b_reverse_charge" || t.vat_treatment === "eu_acquisition"),
      net = t.amount_net == null ? (selfAssessed ? gross : gross - vat) : Number(t.amount_net);
    const item = {
      id: t.id as string,
      label: (t.counterparty_name || t.description || "") as string,
      date: t.occurred_on as string,
      treatment: t.vat_treatment as string,
      country: (t.counterparty_country as string | null) ?? null,
      rate: t.vat_rate == null ? null : Number(t.vat_rate),
      base: cents(net * fx),
      vat: cents(vat * fx),
      accountCode: account.code,
    };
    if (t.direction === "expense") purchases.push(item);
    else if (account.account_type === "expense")
      // A supplier refund reverses part of a purchase.
      purchases.push({ ...item, base: -item.base, vat: -item.vat });
    else sales.push({ ...item, source: "transaction" });
  }

  let ledgerOutput = 0,
    ledgerInput = 0;
  const vatAccounts = (accounts ?? []).filter(a => a.code === "461411" || a.code === "421611");
  if (entries?.length && vatAccounts.length) {
    const codeById = new Map(vatAccounts.map(a => [a.id as string, a.code as string]));
    const { data: lines } = await supabase
      .from("journal_lines")
      .select("company_account_id,debit,credit")
      .in(
        "journal_entry_id",
        entries.map(e => e.id),
      )
      .in("company_account_id", [...codeById.keys()]);
    for (const line of lines ?? []) {
      const code = codeById.get(line.company_account_id as string);
      if (code === "461411") ledgerOutput += Number(line.credit) - Number(line.debit);
      if (code === "421611") ledgerInput += Number(line.debit) - Number(line.credit);
    }
  }

  const result = computeVatReturn({ form: period.form, company: vatCompanyProfile(company), sales, purchases });
  const ledger = { output: cents(ledgerOutput), input: cents(ledgerInput) };
  // Rounding on foreign-currency invoices can differ by a few cents between the lines and the posted total.
  const reconciled =
    Math.abs(ledger.output - (result.boxes["076"] ?? 0)) < 0.05 &&
    Math.abs(ledger.input - (result.boxes["102"] ?? 0)) < 0.05;
  return { ...result, ledger, reconciled };
}
