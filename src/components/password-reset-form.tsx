"use client";

import { Check, LoaderCircle, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./security-settings.module.css";

export function PasswordResetForm({ locale }: { locale: "en" | "fr" }) {
  const fr = locale === "fr";
  const l = (en: string, french: string) => fr ? french : en;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (password.length < 8) return setMessage(l("Use at least 8 characters.", "Utilisez au moins 8 caractères."));
    if (password !== confirm) return setMessage(l("The passwords do not match.", "Les mots de passe ne correspondent pas."));
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setComplete(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : l("The password could not be updated.", "Le mot de passe n’a pas pu être mis à jour."));
    } finally {
      setBusy(false);
    }
  }

  if (complete) return <div className={styles.resetSuccess}><Check size={20}/><div><strong>{l("Password updated", "Mot de passe mis à jour")}</strong><p>{l("Your new password is active. You can return to your workspace.", "Votre nouveau mot de passe est actif. Vous pouvez revenir à votre espace.")}</p><Link href="/auth/resolve">{l("Continue to Zuelen", "Continuer vers Zuelen")}</Link></div></div>;

  return <form className={styles.resetForm} onSubmit={submit}>
    <div className={styles.resetIcon}><LockKeyhole size={20}/></div>
    <h1>{l("Choose a new password", "Choisissez un nouveau mot de passe")}</h1>
    <p>{l("Use a unique password you do not reuse on another service.", "Utilisez un mot de passe unique que vous ne réutilisez pas sur un autre service.")}</p>
    <label><span>{l("New password", "Nouveau mot de passe")}</span><input type="password" autoComplete="new-password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} required/></label>
    <label><span>{l("Confirm password", "Confirmer le mot de passe")}</span><input type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={event => setConfirm(event.target.value)} required/></label>
    {message ? <div className={styles.error} role="alert">{message}</div> : null}
    <button type="submit" disabled={busy}>{busy ? <LoaderCircle className={styles.spin} size={16}/> : null}{l("Update password", "Mettre à jour le mot de passe")}</button>
  </form>;
}
