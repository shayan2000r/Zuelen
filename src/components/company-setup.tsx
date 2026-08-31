"use client";

import { ArrowRight, Building2, Check, ChevronLeft, FileUp, Keyboard, LoaderCircle, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { switchWorkspaceAction } from "@/app/workspace-actions";
import { SetupToolbar } from "@/components/setup-toolbar";
import type { Locale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import styles from "./auth.module.css";
import polish from "./company-setup-polish.module.css";

function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42); }

export function CompanySetup({ locale }: { locale: Locale }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fr = locale === "fr";
  const l = (en: string, french: string) => fr ? french : en;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [legalName, setLegalName] = useState("");
  const [legalForm, setLegalForm] = useState("SARL-S");
  const [rcsNumber, setRcsNumber] = useState("");
  const [businessPermit, setBusinessPermit] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("LU");
  const [openingChoice, setOpeningChoice] = useState<"upload" | "manual" | "later">("later");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function continueFromProfile() {
    if (!formRef.current?.reportValidity()) return;
    setStep(2);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step !== 3) return;
    setLoading(true); setMessage(null);
    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error(l("Please sign in again before setting up your company.", "Veuillez vous reconnecter avant de configurer votre société."));
      const slugBase = slugify(legalName) || "company";
      const slug = `${slugBase}-${authData.user.id.slice(0, 6)}-${Date.now().toString(36).slice(-4)}`;
      const normalizedPostal = country === "LU" ? `L-${postalCode}` : postalCode;
      const { data, error } = await supabase.rpc("create_company_workspace_v2", {
        p_legal_name: legalName, p_slug: slug, p_legal_form: legalForm, p_rcs_number: rcsNumber || null,
        p_vat_number: vatNumber || null, p_municipality: city || null, p_vat_registered: Boolean(vatNumber.trim()),
        p_business_permit_number: businessPermit || null,
        p_registered_address: { street, postal_code: normalizedPostal, city, country_code: country },
      });
      if (error) throw error;
      const next = new FormData();
      next.set("company_id", String(data));
      next.set("return_to", openingChoice === "later" ? "/app" : `/app/accounting?opening=${openingChoice}`);
      await switchWorkspaceAction(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : l("We could not create the company workspace.", "Nous n’avons pas pu créer l’espace société."));
    } finally { setLoading(false); }
  }

  return <main className={styles.setupShell}>
    <header className={styles.setupTop}><div className={styles.setupBrand}><Image className={styles.logoMark} src="/zuelen-icon.png" alt="" width={34} height={34}/><span>Zuelen</span></div><SetupToolbar locale={locale}/></header>
    <div className={styles.setupGrid}>
      <aside className={styles.setupAside}>
        <p className={styles.overline}>{l("Company · Setup", "Société · Configuration")}</p><h1>{l("Tell Zuelen about your company.", "Présentez votre société à Zuelen.")}</h1><p>{l("Enter the official details used on invoices, RCS records and government portals. Zuelen uses them to configure the right accounting and compliance workflows.", "Saisissez les informations officielles utilisées sur les factures, au RCS et sur les portails publics. Zuelen configure ensuite les bons parcours comptables et réglementaires.")}</p>
        <div className={styles.setupSteps}>
          <div className={step === 1 ? styles.activeStep : ""}><span>01</span><p><strong>{l("Company profile", "Profil de la société")}</strong><small>{l("Legal identity and VAT status", "Identité juridique et statut TVA")}</small></p></div>
          <div className={step === 2 ? styles.activeStep : ""}><span>02</span><p><strong>{l("Opening position", "Situation d’ouverture")}</strong><small>{l("Choose how to bring in opening balances", "Choisissez comment reprendre les soldes")}</small></p></div>
          <div className={step === 3 ? styles.activeStep : ""}><span>03</span><p><strong>{l("Compliance map", "Carte des obligations")}</strong><small>{l("Review before creating the workspace", "Vérifiez avant de créer l’espace")}</small></p></div>
        </div>
      </aside>
      <section className={styles.setupCard}>
        <div className={styles.setupIcon}>{step === 1 ? <Building2 size={21}/> : step === 2 ? <FileUp size={21}/> : <ShieldCheck size={21}/>}</div>
        <h2>{step === 1 ? l("Company profile", "Profil de la société") : step === 2 ? l("Opening position", "Situation d’ouverture") : l("Review your setup", "Vérifiez votre configuration")}</h2>
        <p className={styles.cardLead}>{step === 1 ? l("Use the legal information registered for this business.", "Utilisez les informations juridiques enregistrées pour cette société.") : step === 2 ? l("Choose how you want to prepare the opening position. You can complete it securely after the workspace is created.", "Choisissez comment préparer la situation d’ouverture. Vous pourrez la compléter de manière sécurisée après la création de l’espace.") : l("Zuelen will configure the company workspace, VAT workflow when a VAT number is present, and the applicable compliance starting points.", "Zuelen configurera l’espace société, le parcours TVA lorsqu’un numéro est renseigné et les points de départ des obligations applicables.")}</p>
        <form ref={formRef} className={styles.setupForm} onSubmit={handleSubmit}>
          <div className={`${styles.fullField} ${step === 1 ? polish.visibleStep : polish.hiddenStep}`}>
            <div className={polish.fields}>
              <label className={styles.fullField}><span>{l("Legal company name", "Dénomination légale")}</span><input value={legalName} onChange={event => setLegalName(event.target.value)} placeholder={l("Company name", "Nom de la société")} required/></label>
              <label><span>{l("Legal form", "Forme juridique")}</span><select value={legalForm} onChange={event => setLegalForm(event.target.value)}><option value="SARL-S">SARL-S</option><option value="SARL">SARL</option><option value="SA">SA</option><option value="SAS">SAS</option><option value="SCA">SCA</option><option value="OTHER">{l("Other", "Autre")}</option></select></label>
              <label><span>{l("RCS number", "Numéro RCS")}</span><input value={rcsNumber} onChange={event => setRcsNumber(event.target.value)} placeholder="B 123456" required/></label>
              <label><span>{l("Business permit", "Autorisation d’établissement")}</span><input value={businessPermit} onChange={event => setBusinessPermit(event.target.value)} placeholder="12345678 / 0" required/></label>
              <label><span>{l("VAT number", "Numéro TVA")}</span><input value={vatNumber} onChange={event => setVatNumber(event.target.value.toUpperCase())} placeholder="LU12345678"/></label>
              <label className={styles.fullField}><span>{l("Registered office", "Siège social")}</span><input value={street} onChange={event => setStreet(event.target.value)} placeholder={l("Street and number", "Rue et numéro")} required/></label>
              <label><span>{l("Country", "Pays")}</span><select value={country} onChange={event => { setCountry(event.target.value); setPostalCode(""); }}><option value="LU">Luxembourg</option><option value="BE">Belgique</option><option value="FR">France</option><option value="DE">Deutschland</option></select></label>
              <label><span>{l("Postal code", "Code postal")}</span><span className={polish.postalField}>{country === "LU" ? <b>L-</b> : null}<input value={postalCode} onChange={event => setPostalCode(country === "LU" ? event.target.value.replace(/\D/g, "").slice(0, 4) : event.target.value)} inputMode={country === "LU" ? "numeric" : "text"} pattern={country === "LU" ? "[0-9]{4}" : undefined} maxLength={country === "LU" ? 4 : undefined} placeholder={country === "LU" ? "1234" : ""} required/></span></label>
              <label className={styles.fullField}><span>{l("City", "Ville")}</span><input value={city} onChange={event => setCity(event.target.value)} placeholder="Luxembourg" required/></label>
            </div>
          </div>
          <div className={`${styles.fullField} ${step === 2 ? polish.visibleStep : polish.hiddenStep}`}>
            <div className={polish.choiceGrid}>
              <button type="button" className={openingChoice === "upload" ? polish.choiceActive : ""} onClick={() => setOpeningChoice("upload")}><FileUp size={20}/><strong>{l("Upload documents", "Importer des documents")}</strong><small>{l("Use a prior PCN, P&L or filing document.", "Utilisez un PCN, un compte de résultat ou un document de dépôt antérieur.")}</small></button>
              <button type="button" className={openingChoice === "manual" ? polish.choiceActive : ""} onClick={() => setOpeningChoice("manual")}><Keyboard size={20}/><strong>{l("Enter manually", "Saisir manuellement")}</strong><small>{l("Enter opening PCN debit and credit balances.", "Saisissez les soldes débiteurs et créditeurs du PCN.")}</small></button>
              <button type="button" className={openingChoice === "later" ? polish.choiceActive : ""} onClick={() => setOpeningChoice("later")}><ArrowRight size={20}/><strong>{l("Do this later", "Le faire plus tard")}</strong><small>{l("Continue to the dashboard and return from Ledger.", "Accédez au tableau de bord et reprenez depuis le grand livre.")}</small></button>
            </div>
          </div>
          <div className={`${styles.fullField} ${step === 3 ? polish.visibleStep : polish.hiddenStep}`}>
            <dl className={polish.review}><div><dt>{l("Company", "Société")}</dt><dd>{legalName} · {legalForm}</dd></div><div><dt>{l("Registered office", "Siège social")}</dt><dd>{street}, {country === "LU" ? `L-${postalCode}` : postalCode} {city} · {country}</dd></div><div><dt>{l("VAT", "TVA")}</dt><dd>{vatNumber || l("Not registered", "Non assujettie")}</dd></div><div><dt>{l("Opening position", "Situation d’ouverture")}</dt><dd>{openingChoice === "upload" ? l("Upload documents", "Importer des documents") : openingChoice === "manual" ? l("Enter manually", "Saisir manuellement") : l("Complete later", "Compléter plus tard")}</dd></div></dl>
          </div>
          {message ? <div className={`${styles.message} ${styles.fullField}`} role="alert">{message}</div> : null}
          <div className={`${styles.formActions} ${styles.fullField}`}><button type="button" className={styles.backButton} onClick={() => step === 1 ? router.push("/setup?add=1") : setStep(current => current === 3 ? 2 : 1)}><ChevronLeft size={15}/>{l("Back", "Retour")}</button>{step < 3 ? <button type="button" className={styles.submit} onClick={() => step === 1 ? continueFromProfile() : setStep(3)}><span>{l("Continue", "Continuer")}</span><ArrowRight size={16}/></button> : <button type="submit" className={styles.submit} disabled={loading}>{loading ? <LoaderCircle className={styles.spin} size={17}/> : <Check size={16}/>}<span>{l("Create workspace", "Créer l’espace")}</span></button>}</div>
        </form>
      </section>
    </div>
  </main>;
}
