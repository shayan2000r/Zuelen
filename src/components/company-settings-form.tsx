"use client";

import { Check, Info, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { saveCompanySettings, type SettingsState } from "@/app/app/settings/actions";
import { useI18n } from "@/components/locale-context";
import { FieldGroup, FormSection, SelectField, TextareaField, TextField } from "@/components/zuelen-form-ui-v2";
import styles from "@/app/app/settings/settings.module.css";

const initial: SettingsState = { status: "idle", message: "" };
type Company = { legal_name: string; trading_name: string | null; legal_form: string; entity_kind: "independent"|"company"; rcs_number: string | null; vat_number: string | null; tax_number: string | null; business_permit_number: string | null; municipality: string | null; activity: string | null; fiscal_year_start_month: number; base_currency: string; vat_registered: boolean; vat_filing_frequency: string | null; registered_address: Record<string, unknown> };
function address(company: Company, key: string) { const value = company.registered_address?.[key]; return typeof value === "string" ? value : ""; }
function turnoverBracket(frequency:string|null){return frequency==="monthly"?"over_620k":frequency==="quarterly"?"112k_to_620k":"up_to_112k"}
type IndependentProfile = { activity_category:string; activity_start_date:string; accounting_start_date:string } | null;
type TaxProfile = { icc_multiplier:number|null; icc_multiplier_year:number|null; prior_closing_balance_total:number|null } | null;

export function CompanySettingsForm({ company, independentProfile=null, taxProfile=null }: { company: Company; independentProfile?:IndependentProfile; taxProfile?:TaxProfile }) {
  const [state, action, pending] = useActionState(saveCompanySettings, initial);
  const { locale, intlLocale } = useI18n();
  const fr = locale === "fr";
  const independent = company.entity_kind === "independent";

  return <form action={action} className={styles.form}>
    <input type="hidden" name="legal_form" value={company.legal_form}/>

    <section className={styles.businessDetailsIntro}>
      <div>
        <p>{independent?(fr?"Détails de l’activité":"Business details"):(fr?"Détails de l’entreprise":"Business details")}</p>
        <h2>{fr?"Les informations que Zuelen réutilise partout":"The information Zuelen reuses across your workspace"}</h2>
        <span>{fr?"Ces données alimentent les factures, documents, calculs fiscaux et rapports. Modifiez-les ici une seule fois.":"These details feed invoices, documents, tax calculations and reports. Update them once here."}</span>
      </div>
      <nav aria-label={fr?"Sections des informations professionnelles":"Business details sections"}>
        <a href="#business-identity">{fr?"Identité":"Identity"}</a>
        <a href="#business-registrations">{fr?"Immatriculations":"Registrations"}</a>
        <a href="#business-address">{fr?"Adresse":"Address"}</a>
        <a href="#business-accounting">{fr?"Comptabilité & TVA":"Accounting & VAT"}</a>
      </nav>
    </section>

    <div id="business-identity" className={styles.settingsAnchor}>
      <FormSection title={independent ? (fr ? "Identité de l’activité" : "Business Identity") : (fr ? "Identité de l’entreprise" : "Business Identity")} description={independent ? (fr ? "Le nom et l’activité utilisés lorsque vous exercez en nom propre." : "The name and activity used when operating in your own name.") : (fr ? "Les informations qui identifient l’entreprise sur les factures et documents officiels." : "The information that identifies the company on invoices and official documents.")}>
        <FieldGroup columns={2}>
          <TextField label={independent ? (fr ? "Nom légal personnel" : "Personal legal name") : (fr ? "Dénomination légale" : "Legal company name")} name="legal_name" defaultValue={company.legal_name} required />
          <TextField label={fr ? "Nom commercial" : "Trading name"} name="trading_name" defaultValue={company.trading_name ?? ""} placeholder={fr ? "Nom public facultatif" : "Optional public name"} />
          {!independent?<SelectField label={fr ? "Forme juridique" : "Legal form"} name="legal_form_display" defaultValue={company.legal_form} onChange={event=>{const hidden=event.currentTarget.form?.elements.namedItem("legal_form");if(hidden instanceof HTMLInputElement)hidden.value=event.target.value}}><option value="SARL-S">SARL-S</option><option value="SARL">SARL</option><option value="SA">SA</option><option value="SAS">SAS</option><option value="SCA">SCA</option><option value="OTHER">{fr ? "Autre" : "Other"}</option></SelectField>:null}
        </FieldGroup>
        <FieldGroup columns={1}><TextareaField label={independent ? (fr ? "Description de l’activité" : "Activity description") : (fr ? "Activité principale" : "Main business activity")} name="activity" defaultValue={company.activity ?? ""} rows={3} placeholder={independent ? (fr ? "Ex. conception web et développement pour des clients professionnels" : "e.g. web design and development for business clients") : (fr ? "Décrivez brièvement l’activité principale de l’entreprise" : "Briefly describe the company’s main activity")} /></FieldGroup>
      </FormSection>
    </div>

    {independent?<FormSection title={fr ? "Cadre de l’activité" : "Activity Setup"} description={fr ? "Dates et catégorie utilisées pour adapter les parcours comptables et fiscaux." : "Dates and category used to adapt accounting and tax workflows."}><FieldGroup columns={2}><SelectField label={fr ? "Type d’activité" : "Activity type"} name="activity_category" defaultValue={independentProfile?.activity_category??"other"}><option value="consultant_freelancer">{fr?"Consultant / freelance":"Consultant / freelancer"}</option><option value="liberal_profession">{fr?"Profession libérale":"Liberal profession"}</option><option value="commercial">{fr?"Activité commerciale":"Commercial / trading"}</option><option value="craft">{fr?"Artisanat":"Craft / artisan"}</option><option value="other">{fr?"Autre":"Other"}</option></SelectField><TextField label={fr?"Début de l’activité":"Activity start date"} name="activity_start_date" type="date" defaultValue={independentProfile?.activity_start_date??""} required/><TextField label={fr?"Début de la comptabilité dans Zuelen":"Accounting start date"} name="accounting_start_date" type="date" defaultValue={independentProfile?.accounting_start_date??""} required/></FieldGroup></FormSection>:null}

    <div id="business-registrations" className={styles.settingsAnchor}>
      <FormSection title={fr ? "Immatriculations et identifiants" : "Registrations & Identifiers"} description={fr ? "Ajoutez uniquement les numéros effectivement attribués à votre activité. Un champ vide ne bloque pas Zuelen." : "Add only identifiers that have actually been issued to your business. Leaving a field blank does not block Zuelen."}>
        <FieldGroup columns={2}>
          <TextField label={fr ? "Numéro RCS" : "RCS number"} name="rcs_number" defaultValue={company.rcs_number ?? ""} placeholder={fr?"Facultatif · ex. B 123456":"Optional · e.g. B 123456"} />
          <TextField label={fr ? "Autorisation d’établissement" : "Business permit"} name="business_permit_number" defaultValue={company.business_permit_number ?? ""} placeholder={fr?"Facultatif · si délivrée":"Optional · if issued"} />
          <TextField label={fr ? "Numéro TVA" : "VAT number"} name="vat_number" defaultValue={company.vat_number ?? ""} placeholder="LU12345678" />
          <TextField label={fr ? "Numéro fiscal ACD" : "ACD tax number"} name="tax_number" defaultValue={company.tax_number ?? ""} placeholder={fr ? "Facultatif · si connu" : "Optional · if known"} />
        </FieldGroup>
        <div className={styles.registrationNote}><span><Info size={14}/></span><p>{fr?"RCS et autorisation d’établissement ne s’appliquent pas à toutes les situations et peuvent aussi être délivrés plus tard. Laissez simplement ces champs vides si vous ne les avez pas encore ; Zuelen signalera les mentions manquantes uniquement lorsqu’elles deviennent pertinentes, par exemple lors de la création d’une facture.":"RCS and business-permit details do not apply in every situation and may also be issued later. Leave them blank if you do not have them yet; Zuelen will flag missing legal details only when they become relevant, for example during invoice creation."}</p></div>
      </FormSection>
    </div>

    <div id="business-address" className={styles.settingsAnchor}>
      <FormSection title={independent?(fr ? "Adresse de l’activité" : "Business Address"):(fr ? "Siège social" : "Registered Office")} description={independent ? (fr ? "Adresse de contact ou d’établissement utilisée pour l’activité." : "Contact or establishment address used for the business.") : (fr ? "Adresse officielle de l’entreprise utilisée sur les documents et pour les paramètres locaux." : "Official company address used on documents and for local settings.")}>
        <FieldGroup columns={1}><TextField label={fr ? "Rue" : "Street"} name="street" defaultValue={address(company, "street")} placeholder="12 rue du Commerce" /></FieldGroup>
        <FieldGroup columns={2}><TextField label={fr ? "Code postal" : "Postal code"} name="postal_code" defaultValue={address(company, "postal_code")} placeholder="L-1234" /><TextField label={fr ? "Ville" : "City"} name="city" defaultValue={address(company, "city")} placeholder="Luxembourg" /><TextField label={fr ? "Commune fiscale" : "Municipality"} name="municipality" defaultValue={company.municipality ?? ""} placeholder="Luxembourg" /><TextField label={fr ? "Code pays" : "Country code"} name="country_code" defaultValue={address(company, "country_code") || "LU"} maxLength={2} /></FieldGroup>
      </FormSection>
    </div>

    <div id="business-accounting" className={styles.settingsAnchor}>
      <FormSection title={fr ? "Comptabilité et TVA" : "Accounting & VAT"} description={fr ? "Paramètres structurels utilisés par les transactions, rapports et parcours TVA. Vous ne devriez pas devoir les modifier souvent." : "Structural settings used by transactions, reports and VAT workflows. You should rarely need to change them."}>
        <FieldGroup columns={2}>
          <SelectField label={fr ? "Devise de base" : "Base currency"} name="base_currency" defaultValue={company.base_currency}><option value="EUR">EUR · Euro</option><option value="USD">USD · {fr ? "Dollar américain" : "US Dollar"}</option><option value="GBP">GBP · {fr ? "Livre sterling" : "Pound sterling"}</option><option value="CHF">CHF · {fr ? "Franc suisse" : "Swiss franc"}</option></SelectField>
          <SelectField label={fr ? "Début de l’exercice" : "Fiscal year starts"} name="fiscal_year_start_month" defaultValue={String(company.fiscal_year_start_month)}>{Array.from({ length: 12 }, (_, index) => <option value={index + 1} key={index}>{new Date(2026, index, 1).toLocaleDateString(intlLocale, { month: "long" })}</option>)}</SelectField>
          <SelectField label={fr ? "Chiffre d’affaires annuel HT attendu" : "Expected annual turnover excl. VAT"} name="turnover_bracket" defaultValue={turnoverBracket(company.vat_filing_frequency)}><option value="up_to_112k">≤ €112,000 · {fr?"déclaration annuelle":"annual return"}</option><option value="112k_to_620k">€112,000.01 – €620,000 · {fr?"trimestrielle + annuelle":"quarterly + annual"}</option><option value="over_620k">&gt; €620,000 · {fr?"mensuelle + annuelle":"monthly + annual"}</option></SelectField>
        </FieldGroup>
        <p className={styles.formHint}>{company.vat_number
          ?(fr?"Votre numéro de TVA indique que l’activité est enregistrée à la TVA. La tranche de chiffre d’affaires aide Zuelen à proposer une périodicité, mais l’AED reste compétente pour confirmer la fréquence applicable.":"Your VAT number indicates VAT registration. The turnover bracket helps Zuelen suggest a filing cadence, but the AED remains the authority for the applicable frequency.")
          :(fr?"Aucun numéro de TVA n’est enregistré. Zuelen ne traitera donc pas l’activité comme assujettie à la TVA tant qu’un numéro n’est pas ajouté.":"No VAT number is currently stored. Zuelen will therefore not treat the business as VAT registered until one is added.")}</p>
      </FormSection>
    </div>

    {!independent ? <details className={styles.advancedDetails}>
      <summary><div><span>{fr?"Paramètres avancés":"Advanced settings"}</span><strong>{fr?"Fiscalité directe et données de clôture":"Direct tax & closing data"}</strong><small>{fr?"À modifier uniquement si vous connaissez les valeurs ou si votre comptable vous les fournit.":"Only change these when you know the values or your accountant provides them."}</small></div><em>{fr?"Ouvrir":"Open"}</em></summary>
      <div className={styles.advancedBody}><FieldGroup columns={2}><TextField label={fr ? "Multiplicateur communal ICC (%)" : "Municipal ICC multiplier (%)"} name="icc_multiplier_percent" type="number" min="0.01" max="1000" step="0.01" defaultValue={taxProfile?.icc_multiplier == null ? "" : String(Number(taxProfile.icc_multiplier) * 100)} placeholder="225" /><TextField label={fr ? "Année du multiplicateur" : "Multiplier year"} name="icc_multiplier_year" type="number" min="2025" max="2100" step="1" defaultValue={taxProfile?.icc_multiplier_year == null ? String(new Date().getFullYear()) : String(taxProfile.icc_multiplier_year)} /><TextField label={fr ? "Total du bilan de clôture précédent" : "Prior closing balance total"} name="prior_balance_total" type="number" min="0" step="0.01" defaultValue={taxProfile?.prior_closing_balance_total == null ? "" : String(taxProfile.prior_closing_balance_total)} placeholder="0.00" /></FieldGroup></div>
    </details> : null}

    <div className={styles.saveBar}>{state.message ? <span className={state.status === "error" ? styles.error : styles.success}>{state.message}</span> : <span>{fr?"Les modifications sont réutilisées automatiquement dans Zuelen.":"Changes are automatically reused across Zuelen."}</span>}<button type="submit" disabled={pending}>{pending ? <LoaderCircle className={styles.spin} size={15} /> : <Check size={15} />} {pending ? (fr ? "Enregistrement…" : "Saving…") : (fr ? "Enregistrer les informations" : "Save business details")}</button></div>
  </form>;
}
