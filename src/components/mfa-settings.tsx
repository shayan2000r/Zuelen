"use client";

import { Check, KeyRound, LoaderCircle, ShieldCheck, ShieldOff } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./security-settings.module.css";

type Factor = { id: string; status: "verified" | "unverified"; friendly_name?: string; created_at?: string };
type Enrollment = { id: string; qrCode: string; secret: string };

export function MfaSettings({ locale }: { locale: "en" | "fr" }) {
  const router = useRouter();
  const fr = locale === "fr";
  const l = (en: string, french: string) => fr ? french : en;
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    setFactors((data.all ?? []) as Factor[]);
  }

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.auth.mfa.listFactors().then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage(error.message);
      else setFactors((data.all ?? []) as Factor[]);
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function startEnrollment() {
    setBusy(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { data: listed } = await supabase.auth.mfa.listFactors();
      for (const factor of (listed?.all ?? []) as Factor[]) if (factor.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Zuelen authenticator" });
      if (error) throw error;
      setEnrollment({ id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : l("Two-factor setup could not start.", "La configuration de la double authentification n’a pas pu démarrer."));
    } finally {
      setBusy(false);
    }
  }

  async function verifyEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment || !/^\d{6}$/.test(code)) return setMessage(l("Enter the 6-digit authenticator code.", "Saisissez le code à 6 chiffres de l’application."));
    setBusy(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: enrollment.id });
      if (challengeError) throw challengeError;
      const { error } = await supabase.auth.mfa.verify({ factorId: enrollment.id, challengeId: challenge.id, code });
      if (error) throw error;
      setEnrollment(null);
      setCode("");
      await load();
      setMessage(l("Two-factor authentication is now enabled.", "La double authentification est maintenant activée."));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : l("The code could not be verified.", "Le code n’a pas pu être vérifié."));
    } finally {
      setBusy(false);
    }
  }

  async function disable(factorId: string) {
    if (!window.confirm(l("Disable two-factor authentication for this authenticator?", "Désactiver la double authentification pour cet authentificateur ?"))) return;
    setBusy(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      await load();
      setMessage(l("Two-factor authentication has been disabled.", "La double authentification a été désactivée."));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : l("Two-factor authentication could not be disabled.", "La double authentification n’a pas pu être désactivée."));
    } finally {
      setBusy(false);
    }
  }

  const verified = factors.filter(factor => factor.status === "verified");

  return <section className={styles.securityCard}>
    <div className={styles.securityHead}><span><ShieldCheck size={19}/></span><div><p>{l("Optional protection", "Protection facultative")}</p><h2>{l("Authenticator app (TOTP)", "Application d’authentification (TOTP)")}</h2></div><em className={verified.length ? styles.enabled : styles.optional}>{verified.length ? l("Enabled", "Activée") : l("Recommended", "Recommandée")}</em></div>
    <p className={styles.securityLead}>{l("Add a second step to future sign-ins with any standards-based authenticator app. Two-factor authentication is optional and applies to your Zuelen identity across all workspaces.", "Ajoutez une deuxième étape aux prochaines connexions avec toute application d’authentification compatible. La double authentification est facultative et s’applique à votre identité Zuelen dans tous vos espaces.")}</p>
    {busy && !enrollment && !factors.length ? <div className={styles.loading}><LoaderCircle className={styles.spin} size={16}/>{l("Checking your security settings…", "Vérification de vos paramètres de sécurité…")}</div> : null}
    {verified.map(factor => <div className={styles.factorRow} key={factor.id}><span><KeyRound size={17}/></span><div><strong>{factor.friendly_name || l("Authenticator app", "Application d’authentification")}</strong><small>{l("Verified and required on future sign-ins", "Vérifiée et requise lors des prochaines connexions")}</small></div><button type="button" className={styles.dangerAction} onClick={() => disable(factor.id)} disabled={busy}><ShieldOff size={14}/>{l("Disable", "Désactiver")}</button></div>)}
    {!verified.length && !enrollment && !busy ? <button type="button" className={styles.primaryAction} onClick={startEnrollment}><ShieldCheck size={15}/>{l("Enable two-factor authentication", "Activer la double authentification")}</button> : null}
    {enrollment ? <form className={styles.enrollment} onSubmit={verifyEnrollment}>
      <div className={styles.enrollmentCopy}><strong>{l("1. Scan this QR code", "1. Scannez ce code QR")}</strong><p>{l("Open your authenticator app and add a new account.", "Ouvrez votre application d’authentification et ajoutez un nouveau compte.")}</p></div>
      {/* The TOTP provider returns a data-URL SVG that cannot use next/image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={enrollment.qrCode} alt={l("Authenticator QR code", "Code QR d’authentification")}/>
      <div className={styles.secret}><span>{l("Manual setup key", "Clé de configuration manuelle")}</span><code>{enrollment.secret}</code></div>
      <label><span>{l("2. Enter the 6-digit code", "2. Saisissez le code à 6 chiffres")}</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required/></label>
      <div className={styles.enrollmentActions}><button type="button" className={styles.secondaryAction} onClick={() => setEnrollment(null)} disabled={busy}>{l("Cancel", "Annuler")}</button><button type="submit" className={styles.primaryAction} disabled={busy || code.length !== 6}>{busy ? <LoaderCircle className={styles.spin} size={15}/> : <Check size={15}/>} {l("Verify and enable", "Vérifier et activer")}</button></div>
    </form> : null}
    {message ? <div className={styles.notice} role="status">{message}</div> : null}
    <p className={styles.recoveryNote}>{l("Keep access to your authenticator app. If you lose it, contact Zuelen support to recover your account after identity checks.", "Conservez l’accès à votre application d’authentification. En cas de perte, contactez l’assistance Zuelen pour récupérer votre compte après vérification d’identité.")}</p>
  </section>;
}
