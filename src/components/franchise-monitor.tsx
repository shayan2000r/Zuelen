import { Gauge } from "lucide-react";
import { Panel, SectionHeader, StatusBadge } from "@/components/zuelen-ui-v2";
import { intlLocale, type Locale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { FRANCHISE_SOURCE, franchiseStatus } from "@/lib/tax-rules/vat";

function money(value: number, locale: Locale, currency: string) {
  return new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

/**
 * Small-business franchise monitor (LTVA art. 57bis) for businesses that do not charge VAT.
 * Turnover is the posted revenue (PCN class 70) of the calendar year.
 */
export async function FranchiseMonitor({ companyId, locale, currency, year }: { companyId: string; locale: Locale; currency: string; year: number }) {
  const fr = locale === "fr";
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "posted")
    .gte("entry_date", `${year}-01-01`)
    .lte("entry_date", `${year}-12-31`);
  let turnover = 0;
  if (entries?.length) {
    const [{ data: lines }, { data: accounts }] = await Promise.all([
      supabase.from("journal_lines").select("company_account_id,debit,credit").in("journal_entry_id", entries.map((entry) => entry.id)),
      supabase.from("company_accounts").select("id,code").eq("company_id", companyId).like("code", "70%"),
    ]);
    const revenueAccounts = new Set((accounts ?? []).map((account) => account.id));
    for (const line of lines ?? []) {
      if (revenueAccounts.has(line.company_account_id)) turnover += Number(line.credit ?? 0) - Number(line.debit ?? 0);
    }
  }

  const status = franchiseStatus(turnover, year);
  if (status.state === "unknown_year") return null;
  const tone = status.state === "below" ? "success" : status.state === "approaching" ? "info" : status.state === "tolerance" ? "warning" : "danger";
  const label = {
    below: fr ? "Sous le seuil" : "Below the threshold",
    approaching: fr ? "Seuil proche" : "Approaching the threshold",
    tolerance: fr ? "Seuil dépassé (tolérance de 10 %)" : "Threshold exceeded (10 % tolerance)",
    exceeded: fr ? "Franchise perdue" : "Franchise lost",
  }[status.state];
  const message = (() => {
    switch (status.state) {
      case "below":
      case "approaching":
        return fr
          ? `Il reste ${money(status.remaining, locale, currency)} avant le seuil de ${money(status.threshold, locale, currency)} pour ${year}.`
          : `${money(status.remaining, locale, currency)} left before the ${money(status.threshold, locale, currency)} threshold for ${year}.`;
      case "tolerance":
        return fr
          ? `La franchise reste applicable jusqu’au 31 décembre tant que le chiffre d’affaires ne dépasse pas ${money(status.limit, locale, currency)}, mais elle sera exclue pour l’année ${year + 1}. Préparez l’immatriculation à la TVA.`
          : `The franchise still applies until 31 December as long as turnover stays at or below ${money(status.limit, locale, currency)}, but it is excluded for ${year + 1}. Prepare your VAT registration.`;
      case "exceeded":
        return fr
          ? `Le chiffre d’affaires dépasse ${money(status.limit, locale, currency)} : la franchise cesse dès le lendemain du dépassement. Contactez l’AED pour l’immatriculation et facturez la TVA.`
          : `Turnover is above ${money(status.limit, locale, currency)}: the franchise ends from the day after it was exceeded. Contact the AED to register and start charging VAT.`;
    }
  })();

  return (
    <Panel>
      <SectionHeader
        eyebrow={fr ? `Franchise TVA · ${year}` : `VAT franchise · ${year}`}
        title={money(turnover, locale, currency)}
        description={fr ? "Chiffre d’affaires comptabilisé (comptes 70) de l’année civile." : "Revenue posted to class 70 accounts for the calendar year."}
        action={<StatusBadge tone={tone}><Gauge size={13} />{label}</StatusBadge>}
      />
      <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--z-text-secondary)" }}>
        {message}{" "}
        <a href={FRANCHISE_SOURCE} target="_blank" rel="noreferrer">{fr ? "Source : AED" : "Source: AED"}</a>
      </p>
    </Panel>
  );
}
