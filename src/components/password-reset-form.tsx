"use client";

import { Check, LoaderCircle, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRecoveryClient } from "@/lib/supabase/client";
import styles from "./security-settings.module.css";

export function PasswordResetForm({ locale }: { locale: "en" | "fr" }) {
  const fr = locale === "fr";
  const l = (en: string, french: string) => fr ? french : en;
  const supabase = useMemo(() => createRecoveryClient(), []);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let active = true;

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" && session) {
        setReady(true);
        setMessage(null);
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error || !data.session) {
        setMessage(l(
          "This recovery link is invalid or has expired. Request a new link from the sign-in page.",
          "Ce lien de récupération est invalide ou a expiré. Demandez un nouveau lien depuis la page de connexion.",
        ));
        return;
      }
      setReady(true);
      setMessage(null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [fr, supabase]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!ready) {
      setMessage(l(
        "Open a fresh password-reset link from your email first.",
        "Ouvrez d’abord un nouveau lien de réinitialisation reçu par e-mail.",
      ));
      return;
    }
    if (password.length < 8) {
      setMessage(l("Use at least 8 characters.", "Utilisez au moins 8 caractères."));
      return;
    }
    if (password !== confirm) {
      setMessage(l("The passwords do not match.", "Les mots de passe ne correspondent pas."));
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut();
      setComplete(true);
    } catch (error) {
      setMessage(error instanceof Error
        ? error.message
        : l("The password could not be updated.", "Le mot de passe n’a pas pu être mis à jour."));
    } finally {
      setBusy(false);
    }
  }

  if (complete) {
    return (
      <div className={styles.resetSuccess}>
        <Check size={20} />
        <div>
          <strong>{l("Password updated", "Mot de passe mis à jour")}</strong>
          <p>{l(
            "Your new password is active. Sign in with your email and new password.",
            "Votre nouveau mot de passe est actif. Connectez-vous avec votre e-mail et votre nouveau mot de passe.",
          )}</p>
          <Link href="/sign-in">{l("Return to sign in", "Retour à la connexion")}</Link>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.resetForm} onSubmit={submit}>
      <div className={styles.resetIcon}><LockKeyhole size={20} /></div>
      <h1>{l("Choose a new password", "Choisissez un nouveau mot de passe")}</h1>
      <p>{l(
        "Use a unique password you do not reuse on another service.",
        "Utilisez un mot de passe unique que vous ne réutilisez pas sur un autre service.",
      )}</p>
      <label>
        <span>{l("New password", "Nouveau mot de passe")}</span>
        <input
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={event => setPassword(event.target.value)}
          required
          disabled={!ready || busy}
        />
      </label>
      <label>
        <span>{l("Confirm password", "Confirmer le mot de passe")}</span>
        <input
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={confirm}
          onChange={event => setConfirm(event.target.value)}
          required
          disabled={!ready || busy}
        />
      </label>
      {message ? <div className={styles.error} role="alert">{message}</div> : null}
      <button type="submit" disabled={!ready || busy}>
        {busy ? <LoaderCircle className={styles.spin} size={16} /> : null}
        {l("Update password", "Mettre à jour le mot de passe")}
      </button>
    </form>
  );
}
