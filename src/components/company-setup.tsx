"use client";

import { ArrowRight, Building2, Check, ChevronLeft, LoaderCircle, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./auth.module.css";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42);
}

export function CompanySetup() {
  const router = useRouter();
  const [legalName, setLegalName] = useState("");
  const [legalForm, setLegalForm] = useState("SARL-S");
  const [rcsNumber, setRcsNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [vatRegistered, setVatRegistered] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Please sign in again before setting up your company.");

      const slugBase = slugify(legalName) || "company";
      const slug = `${slugBase}-${authData.user.id.slice(0, 6)}-${Date.now().toString(36).slice(-4)}`;
      const { error } = await supabase.rpc("create_company_workspace", {
        p_legal_name: legalName,
        p_slug: slug,
        p_legal_form: legalForm,
        p_rcs_number: rcsNumber || null,
        p_vat_number: vatNumber || null,
        p_municipality: municipality || null,
        p_vat_registered: vatRegistered,
      });
      if (error) throw error;

      router.push("/app");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not create the company workspace.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.setupShell}>
      <header className={styles.setupTop}><div className={styles.setupBrand}><div className={styles.logoMark}>C</div><span>Compta</span></div><span className={styles.secureTag}><ShieldCheck size={13} />Secure workspace setup</span></header>
      <div className={styles.setupGrid}>
        <aside className={styles.setupAside}>
          <p className={styles.overline}>Company 01</p><h1>Tell Compta who you are.</h1><p>We use this profile to decide which accounting and compliance workflows apply to your company.</p>
          <div className={styles.setupSteps}><div className={styles.activeStep}><span>01</span><p><strong>Company profile</strong><small>Legal identity and VAT status</small></p></div><div><span>02</span><p><strong>Opening position</strong><small>Bank, accounting year and balances</small></p></div><div><span>03</span><p><strong>Compliance map</strong><small>Your obligations and next deadlines</small></p></div></div>
        </aside>
        <section className={styles.setupCard}>
          <div className={styles.setupIcon}><Building2 size={21} /></div><h2>Company profile</h2><p className={styles.cardLead}>Start with the official information you already use on invoices and government portals.</p>
          <form className={styles.setupForm} onSubmit={handleSubmit}>
            <label className={styles.fullField}><span>Legal company name</span><input value={legalName} onChange={(event) => setLegalName(event.target.value)} placeholder="TradinGo SARL-S" required /></label>
            <label><span>Legal form</span><select value={legalForm} onChange={(event) => setLegalForm(event.target.value)}><option value="SARL-S">SARL-S</option><option value="SARL">SARL</option><option value="SA">SA</option><option value="SOLE_TRADER">Sole trader</option><option value="OTHER">Other</option></select></label>
            <label><span>Municipality</span><input value={municipality} onChange={(event) => setMunicipality(event.target.value)} placeholder="Bertrange" /></label>
            <label><span>RCS number</span><input value={rcsNumber} onChange={(event) => setRcsNumber(event.target.value)} placeholder="B 000000" /></label>
            <label><span>VAT number</span><input value={vatNumber} onChange={(event) => setVatNumber(event.target.value)} placeholder="LU00000000" /></label>
            <label className={styles.toggleField}><span><strong>VAT registered</strong><small>Compta will create the relevant VAT workflow.</small></span><input type="checkbox" checked={vatRegistered} onChange={(event) => setVatRegistered(event.target.checked)} /></label>
            {message ? <div className={`${styles.message} ${styles.fullField}`}>{message}</div> : null}
            <div className={`${styles.formActions} ${styles.fullField}`}><button type="button" className={styles.backButton} onClick={() => router.push("/sign-in")}><ChevronLeft size={15} />Back</button><button type="submit" className={styles.submit} disabled={loading}>{loading ? <LoaderCircle className={styles.spin} size={17} /> : <Check size={16} />}<span>Create workspace</span>{!loading ? <ArrowRight size={16} /> : null}</button></div>
          </form>
        </section>
      </div>
    </main>
  );
}
