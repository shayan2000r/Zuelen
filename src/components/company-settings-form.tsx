"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { saveCompanySettings, type SettingsState } from "@/app/app/settings/actions";
import { useI18n } from "@/components/locale-context";
import { FieldGroup, FormSection, SelectField, TextareaField, TextField, ToggleField } from "@/components/zuelen-form-ui-v2";
import styles from "@/app/app/settings/settings.module.css";

const initial: SettingsState = { status: "idle", message: "" };
type Company = { legal_name: string; trading_name: string | null; legal_form: string; rcs_number: string | null; vat_number: string | null; tax_number: string | null; business_permit_number: string | null; municipality: string | null; activity: string | null; fiscal_year_start_month: number; base_currency: string; vat_registered: boolean; vat_filing_frequency: string | null; registered_address: Record<string, unknown> };
function address(company: Company, key: string) { const value = company.registered_address?.[key]; return typeof value === "string" ? value : ""; }

export function CompanySettingsForm({ company }: { company: Company }) {
  const [state, action, pending] = useActionState(saveCompanySettings, initial);
  const { locale, intlLocale } = useI18n();
  const fr = locale === "fr";

  return <form action={action} className={styles.form}>
    <FormSection title={fr ? "Informations légales" : "Legal details"} description={fr ? "Identité utilisée sur les factures et documents de l’entreprise." : "Company identity used on invoices and official records."}>
      <FieldGroup columns={1}>
        <TextField label={fr ? "Dénomination légale" : "Legal company name"} name="legal_name" defaultValue={company.legal_name} required />
      </FieldGroup>
      <FieldGroup columns={2}>
        <TextField label={fr ? "Nom commercial" : "Trading name"} name="trading_name" defaultValue={company.trading_name ?? ""} placeholder={fr ? "Nom public facultatif" : "Optional public name"} />
        <SelectField label={fr ? "Forme juridique" : "Legal form"} name="legal_form" defaultValue={company.legal_form}><option value="SARL-S">SARL-S</option><option value="SARL">SARL</option><option value="SA">SA</option><option value="SOLE_TRADER">{fr ? "Entreprise individuelle" : "Sole trader"}</option><option value="OTHER">{fr ? "Autre" : "Other"}</option></SelectField>
        <TextField label={fr ? "Numéro RCS" : "RCS number"} name="rcs_number" defaultValue={company.rcs_number ?? ""} placeholder="B 123456" />
        <TextField label={fr ? "Autorisation d’établissement" : "Business permit"} name="business_permit_number" defaultValue={company.business_permit_number ?? ""} placeholder="12345678 / 0" />
        <TextField label={fr ? "Numéro TVA" : "VAT number"} name="vat_number" defaultValue={company.vat_number ?? ""} placeholder="LU12345678" />
        <TextField label={fr ? "Numéro fiscal" : "Tax number"} name="tax_number" defaultValue={company.tax_number ?? ""} placeholder={fr ? "Référence ACD facultative" : "Optional ACD reference"} />
      </FieldGroup>
      <FieldGroup columns={1}>
        <TextareaField label={fr ? "Activité de l’entreprise" : "Business activity"} name="activity" defaultValue={company.activity ?? ""} rows={3} placeholder={fr ? "Décrivez l’activité principale de l’entreprise" : "Describe the company’s main activity"} />
      </FieldGroup>
    </FormSection>

    <FormSection title={fr ? "Adresse" : "Address"} description={fr ? "Siège social officiel de l’entreprise." : "Official registered office for the company."}>
      <FieldGroup columns={1}><TextField label={fr ? "Rue" : "Street"} name="street" defaultValue={address(company, "street")} placeholder="12 rue du Commerce" /></FieldGroup>
      <FieldGroup columns={2}>
        <TextField label={fr ? "Code postal" : "Postal code"} name="postal_code" defaultValue={address(company, "postal_code")} placeholder="L-1234" />
        <TextField label={fr ? "Ville" : "City"} name="city" defaultValue={address(company, "city")} placeholder="Luxembourg" />
        <TextField label={fr ? "Commune" : "Municipality"} name="municipality" defaultValue={company.municipality ?? ""} placeholder="Luxembourg" />
        <TextField label={fr ? "Code pays" : "Country code"} name="country_code" defaultValue={address(company, "country_code") || "LU"} maxLength={2} />
      </FieldGroup>
    </FormSection>

    <FormSection title={fr ? "Paramètres financiers" : "Financial settings"} description={fr ? "Valeurs par défaut pour la TVA, l’exercice et les rapports." : "Defaults for VAT, the financial year and reporting."}>
      <FieldGroup columns={2}>
        <SelectField label={fr ? "Devise de base" : "Base currency"} name="base_currency" defaultValue={company.base_currency}><option value="EUR">EUR · Euro</option><option value="USD">USD · {fr ? "Dollar américain" : "US Dollar"}</option><option value="GBP">GBP · {fr ? "Livre sterling" : "Pound sterling"}</option><option value="CHF">CHF · {fr ? "Franc suisse" : "Swiss franc"}</option></SelectField>
        <SelectField label={fr ? "Début de l’exercice" : "Fiscal year starts"} name="fiscal_year_start_month" defaultValue={String(company.fiscal_year_start_month)}>{Array.from({ length: 12 }, (_, index) => <option value={index + 1} key={index}>{new Date(2026, index, 1).toLocaleDateString(intlLocale, { month: "long" })}</option>)}</SelectField>
        <SelectField label={fr ? "Fréquence des déclarations TVA" : "VAT filing frequency"} name="vat_filing_frequency" defaultValue={company.vat_filing_frequency ?? "annual"}><option value="annual">{fr ? "Annuelle" : "Annual"}</option><option value="quarterly">{fr ? "Trimestrielle" : "Quarterly"}</option><option value="monthly">{fr ? "Mensuelle" : "Monthly"}</option></SelectField>
      </FieldGroup>
      <ToggleField title={fr ? "Assujetti à la TVA" : "VAT registered"} description={fr ? "Active les workflows de comptabilité et de déclaration TVA." : "Enable VAT accounting and filing workflows."} name="vat_registered" defaultChecked={company.vat_registered} />
    </FormSection>

    <div className={styles.saveBar}>{state.message ? <span className={state.status === "error" ? styles.error : styles.success}>{state.message}</span> : <span>{fr ? "Les modifications mettent à jour le profil de l’entreprise dans Zuelen." : "Changes update the company profile across Zuelen."}</span>}<button type="submit" disabled={pending}>{pending ? <LoaderCircle className={styles.spin} size={15} /> : <Check size={15} />} {pending ? (fr ? "Enregistrement…" : "Saving…") : (fr ? "Enregistrer les modifications" : "Save changes")}</button></div>
  </form>;
}
