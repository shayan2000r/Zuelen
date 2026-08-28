"use client";

import { LoaderCircle, LockKeyhole, LogOut } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeInternalDestination } from "@/lib/safe-navigation";
import styles from "./security-settings.module.css";

export function MfaChallenge({ locale, nextPath }: { locale: "en" | "fr"; nextPath?: string | null }) {
  const router = useRouter();
  const fr = locale === "fr";
  const l = (en: string, french: string) => fr ? french : en;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const destination = safeInternalDestination(nextPath);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) return setMessage(l("Enter the 6-digit code.", "Saisissez le code à 6 chiffres."));
    setBusy(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const factor = factors.totp.find(item => item.status === "verified");
      if (!factor) throw new Error(l("No verified authenticator is available for this account.", "Aucun authentificateur vérifié n’est disponible pour ce compte."));
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challengeError) throw challengeError;
      const { error } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code });
      if (error) throw error;
      router.push(destination ?? "/auth/resolve");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : l("The code could not be verified.", "Le code n’a pas pu être vérifié."));
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    await createClient().auth.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return <div className={styles.challengeCard}><span className={styles.challengeIcon}><LockKeyhole size={22}/></span><p className={styles.challengeKicker}>{l("Two-factor authentication", "Double authentification")}</p><h1>{l("Confirm it’s you.", "Confirmez votre identité.")}</h1><p>{l("Enter the current 6-digit code from your authenticator app to continue.", "Saisissez le code actuel à 6 chiffres de votre application d’authentification pour continuer.")}</p><form onSubmit={verify}><label><span>{l("Authenticator code", "Code d’authentification")}</span><input autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} aria-describedby={message ? "mfa-error" : undefined} required/></label>{message ? <div id="mfa-error" className={styles.error} role="alert">{message}</div> : null}<button type="submit" disabled={busy || code.length !== 6}>{busy ? <LoaderCircle className={styles.spin} size={16}/> : null}{l("Verify and continue", "Vérifier et continuer")}</button></form><button type="button" className={styles.signOut} onClick={signOut} disabled={busy}><LogOut size={14}/>{l("Use another account", "Utiliser un autre compte")}</button></div>;
}
