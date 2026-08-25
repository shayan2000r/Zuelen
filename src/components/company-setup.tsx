"use client";

import { ArrowRight, Building2, Check, ChevronLeft, LoaderCircle, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { switchWorkspaceAction } from "@/app/workspace-actions";
import type { Locale } from "@/lib/i18n";
import styles from "./auth.module.css";

function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42); }

export function CompanySetup({ locale }: { locale: Locale }) {
  const router = useRouter();
  const fr = locale === "fr";
  const l = (en: string, french: string) => fr ? french : en;
  const [legalName, setLegalName] = useState("");
  const [legalForm, setLegalForm] = useState("SARL-S");
  const [rcsNumber, setRcsNumber] = useState("");
  const [businessPermit, setBusinessPermit] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [vatRegistered, setVatRegistered] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage(null);
    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error(l("Please sign in again before setting up your company.", "Veuillez vous reconnecter avant de configurer votre société."));
      const slugBase = slugify(legalName) || "company";
      const slug = `${slugBase}-${authData.user.id.slice(0, 6)}-${Date.now().toString(36).slice(-4)}`;
      const { data, error } = await supabase.rpc("create_company_workspace_v2", {
        p_legal_name: legalName, p_slug: slug, p_legal_form: legalForm, p_rcs_number: rcsNumber || null,
        p_vat_number: vatNumber || null, p_municipality: city || null, p_vat_registered: vatRegistered,
        p_business_permit_number: businessPermit || null,
        p_registered_address: { street, postal_code: postalCode, city, country_code: "LU" },
      });
      if (error) throw error;
      const next = new FormData(); next.set("company_id", String(data)); next.set("return_to", "/app");
      await switchWorkspaceAction(next);
    } catch (error) { setMessage(error instanceof Error ? error.message : l("We could not create the company workspace.", "Nous n’avons pas pu créer l’espace société.")); }
    finally { setLoading(false); }
  }

  return (
    <main className={styles.setupShell}>
      <header className={styles.setupTop}><div className={styles.setupBrand}><Image className={styles.logoMark} src="/zuelen-icon.png" alt="" width={34} height={34}/><span>Zuelen</span></div><span className={styles.secureTag}><ShieldCheck size={13} />{l("Secure workspace setup", "Configuration sécurisée")}</span></header>
      <div className={styles.setupGrid}>
        <aside className={styles.setupAside}>
          <p className={styles.overline}>{l("Company · Setup", "Société · Configuration")}</p><h1>{l("Tell Zuelen about your company.", "Présentez votre société à Zuelen.")}</h1><p>{l("Enter the official details used on invoices, RCS records and government portals. Zuelen uses them to configure the right accounting and compliance workflows.", "Saisissez les informations officielles utilisées sur les factures, au RCS et sur les portails publics. Zuelen configure ensuite les bons parcours comptables et réglementaires.")}</p>
          <div className={styles.setupSteps}><div className={styles.activeStep}><span>01</span><p><strong>{l("Company profile", "Profil de la société")}</strong><small>{l("Legal identity and VAT status", "Identité juridique et statut TVA")}</small></p></div><div><span>02</span><p><strong>{l("Opening position", "Situation d’ouverture")}</strong><small>{l("Bank, accounting year and balances", "Banque, exercice et soldes")}</small></p></div><div><span>03</span><p><strong>{l("Compliance map", "Carte des obligations")}</strong><small>{l("Your obligations and next deadlines", "Vos obligations et prochaines échéances")}</small></p></div></div>
        </aside>
        <section className={styles.setupCard}>
          <div className={styles.setupIcon}><Building2 size={21} /></div><h2>{l("Company profile", "Profil de la société")}</h2><p className={styles.cardLead}>{l("Use the legal information registered for this business. The examples below are intentionally generic.", "Utilisez les informations juridiques enregistrées pour cette société. Les exemples sont volontairement génériques.")}</p>
          <form className={styles.setupForm} onSubmit={handleSubmit}>
            <label className={styles.fullField}><span>{l("Legal company name", "Dénomination légale")}</span><input value={legalName} onChange={(event) => setLegalName(event.target.value)} placeholder="Example Consulting SARL-S" required /></label>
            <label><span>{l("Legal form", "Forme juridique")}</span><select value={legalForm} onChange={(event) => setLegalForm(event.target.value)}><option value="SARL-S">SARL-S</option><option value="SARL">SARL</option><option value="SA">SA</option><option value="SAS">SAS</option><option value="SCA">SCA</option><option value="OTHER">{l("Other", "Autre")}</option></select></label>
            <label><span>{l("RCS number", "Numéro RCS")}</span><input value={rcsNumber} onChange={(event) => setRcsNumber(event.target.value)} placeholder="B 123456" required /></label>
            <label><span>{l("Business permit", "Autorisation d’établissement")}</span><input value={businessPermit} onChange={(event) => setBusinessPermit(event.target.value)} placeholder="12345678 / 0" required /></label>
            <label><span>{l("VAT number", "Numéro TVA")}</span><input value={vatNumber} onChange={(event) => setVatNumber(event.target.value)} placeholder="LU12345678" required={vatRegistered} /></label>
            <label className={styles.fullField}><span>{l("Registered office", "Siège social")}</span><input value={street} onChange={(event) => setStreet(event.target.value)} placeholder="12 rue du Commerce" required /></label>
            <label><span>{l("Postal code", "Code postal")}</span><input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} placeholder="L-1234" required /></label>
            <label><span>{l("City", "Ville")}</span><input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Luxembourg" required /></label>
            <label className={styles.toggleField}><span><strong>{l("VAT registered", "Assujettie à la TVA")}</strong><small>{l("Zuelen will create the relevant VAT workflow.", "Zuelen créera le parcours TVA correspondant.")}</small></span><input type="checkbox" checked={vatRegistered} onChange={(event) => setVatRegistered(event.target.checked)} /></label>
            {message ? <div className={`${styles.message} ${styles.fullField}`}>{message}</div> : null}
            <div className={`${styles.formActions} ${styles.fullField}`}><button type="button" className={styles.backButton} onClick={() => router.push("/setup?add=1")}><ChevronLeft size={15} />{l("Back", "Retour")}</button><button type="submit" className={styles.submit} disabled={loading}>{loading ? <LoaderCircle className={styles.spin} size={17} /> : <Check size={16} />}<span>{l("Create company workspace", "Créer l’espace société")}</span>{!loading ? <ArrowRight size={16} /> : null}</button></div>
          </form>
        </section>
      </div>
    </main>
  );
}
