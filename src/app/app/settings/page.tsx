import { Building2 } from "lucide-react";
import { redirect } from "next/navigation";
import { BrandImageUploader } from "@/components/brand-image-uploader";
import { CompanySettingsForm } from "@/components/company-settings-form";
import { PageHeader, V2Page } from "@/components/zuelen-ui-v2";
import { localizedRole, normalizeLocale } from "@/lib/i18n";
import { canManageOrganization } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import styles from "./settings.module.css";

export const dynamic = "force-dynamic";

function address(raw: Record<string, unknown>, key: string) {
  const value = raw?.[key];
  return typeof value === "string" && value ? value : "—";
}

export default async function SettingsPage() {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in");
  if (!workspace.company || !workspace.organization) redirect("/setup");

  const locale = normalizeLocale(workspace.profile?.locale);
  const fr = locale === "fr";
  const independent = workspace.company.entity_kind === "independent";
  const supabase = await createClient();
  const canManage = canManageOrganization(workspace.role);
  const [brand, independentProfileResult, taxProfileResult] = await Promise.all([
    workspace.company.brand_image_path
      ? supabase.storage.from("company-documents").createSignedUrl(workspace.company.brand_image_path, 60 * 60)
      : Promise.resolve({ data: null, error: null }),
    independent
      ? supabase.from("independent_activity_profiles").select("activity_category,activity_start_date,accounting_start_date").eq("company_id", workspace.company.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    independent
      ? Promise.resolve({ data: null, error: null })
      : supabase.from("company_tax_profiles").select("icc_multiplier,icc_multiplier_year,prior_closing_balance_total").eq("company_id", workspace.company.id).maybeSingle(),
  ]);

  return <V2Page className={styles.page}>
    <PageHeader
      eyebrow={fr ? "Profil et paramètres" : "Profile & settings"}
      title={fr ? "Informations professionnelles" : "Business Settings"}
      description={independent
        ? (fr ? "Gérez les informations de l’activité utilisées dans les factures, documents, rapports et parcours fiscaux." : "Manage the business information used across invoices, documents, reports and tax workflows.")
        : (fr ? "Gérez les informations de l’entreprise utilisées dans les factures, documents, rapports et parcours fiscaux." : "Manage the company information used across invoices, documents, reports and tax workflows.")}
    />

    <section className={styles.settingsGroup}>
      <div className={styles.groupHead}><span className={styles.groupIcon}><Building2 size={18}/></span><div><p>{independent?(fr?"Activité":"Business"):(fr?"Entreprise":"Business")}</p><h2>{fr?"Informations professionnelles":"Business details"}</h2><span>{fr?"Ces informations sont réutilisées dans les factures, documents, rapports et parcours fiscaux.":"These details are reused in invoices, documents, reports and tax workflows."}</span></div></div>
      {canManage ? <>
        <BrandImageUploader organizationId={workspace.organization.id} companyId={workspace.company.id} currentPath={workspace.company.brand_image_path} currentUrl={brand.data?.signedUrl ?? null} companyName={workspace.company.trading_name || workspace.company.legal_name}/>
        <CompanySettingsForm company={workspace.company} independentProfile={independentProfileResult.data} taxProfile={taxProfileResult.data}/>
      </> : <section className={styles.readOnlyCompany}>
        <div className={styles.readOnlyHead}><span><Building2 size={18}/></span><div><p>{independent ? (fr ? "Profil de l’activité" : "Activity profile") : (fr ? "Profil de l’entreprise" : "Company profile")}</p><h2>{workspace.company.trading_name || workspace.company.legal_name}</h2></div><em>{localizedRole(locale, workspace.role)} · {fr ? "lecture seule" : "read only"}</em></div>
        <div className={styles.readOnlyGrid}>
          <div><span>{independent ? (fr ? "Nom légal personnel" : "Personal legal name") : (fr ? "Dénomination légale" : "Legal name")}</span><strong>{workspace.company.legal_name}</strong></div>
          {!independent ? <div><span>{fr ? "Forme juridique" : "Legal form"}</span><strong>{workspace.company.legal_form}</strong></div> : null}
          <div><span>{fr ? "Numéro RCS" : "RCS number"}</span><strong>{workspace.company.rcs_number || "—"}</strong></div>
          <div><span>{fr ? "Numéro TVA" : "VAT number"}</span><strong>{workspace.company.vat_number || "—"}</strong></div>
          <div><span>{independent ? (fr ? "Adresse de l’activité" : "Business address") : (fr ? "Siège social" : "Registered office")}</span><strong>{address(workspace.company.registered_address, "street")}, {address(workspace.company.registered_address, "postal_code")} {address(workspace.company.registered_address, "city")}</strong></div>
          <div><span>{fr ? "Devise de base" : "Base currency"}</span><strong>{workspace.company.base_currency}</strong></div>
        </div>
        <p className={styles.readOnlyNote}>{fr ? "Seul un Propriétaire ou un Administrateur peut modifier ces informations." : "Only an Owner or Admin can change these details."}</p>
      </section>}
    </section>
  </V2Page>;
}
