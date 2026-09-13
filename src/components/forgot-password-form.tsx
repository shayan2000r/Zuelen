"use client";

import { ArrowLeft, Check, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { createRecoveryClient } from "@/lib/supabase/client";
import styles from "./security-settings.module.css";

export function ForgotPasswordForm({ locale }: { locale: "en" | "fr" }) {
  const fr = locale === "fr";
  const l = (en: string, french: string) => fr ? french : en;
  const supabase = useMemo(() => createRecoveryClient(), []);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setMessage(l("Enter a valid email address.", "Saisissez une adresse e-mail valide."));
      return;
    }

    setBusy(true);
    try {
      const resetUrl = new URL("/account/password-reset", window.location.origin);
      resetUrl.searchParams.set("lang", locale);

      const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
        redirectTo: resetUrl.toString(),
      });
      if (error) throw error;

      setSent(true);
    } catch (error) {
      setMessage(error instanceof Error
        ? error.message
        : l(
            "The reset email could not be requested. Please try again.",
            "L’e-mail de réinitialisation n’a pas pu être demandé. Veuillez réessayer.",
          ));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className={styles.resetSuccess}>
        <Check size={20} />
        <div>
          <strong>{l("Check your inbox", "Consultez votre boîte mail")}</strong>
          <p>{l(
            "If a Zuelen account exists for that email, a secure password-reset link has been sent. You can open the email in any browser or device.",
            "Si un compte Zuelen correspond à cet e-mail, un lien sécurisé de réinitialisation a été envoyé. Vous pouvez ouvrir l’e-mail depuis n’importe quel navigateur ou appareil.",
          )}</p>
          <Link href="/sign-in">{l("Return to sign in", "Retour à la connexion")}</Link>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.resetForm} onSubmit={submit}>
      <div className={styles.resetIcon}><Mail size={20} /></div>
      <div className={styles.recoveryKicker}>
        <ShieldCheck size={13} />
        {l("Secure account recovery", "Récupération sécurisée du compte")}
      </div>
      <h1>{l("Reset your password", "Réinitialiser votre mot de passe")}</h1>
      <p>{l(
        "Enter the email address linked to your Zuelen account. We’ll send you a secure link to choose a new password.",
        "Saisissez l’adresse e-mail liée à votre compte Zuelen. Nous vous enverrons un lien sécurisé pour choisir un nouveau mot de passe.",
      )}</p>
      <label>
        <span>{l("Email address", "Adresse e-mail")}</span>
        <input
          type="email"
          autoComplete="email"
          placeholder="you@example.lu"
          value={email}
          onChange={event => setEmail(event.target.value)}
          required
          disabled={busy}
        />
      </label>
      {message ? <div className={styles.error} role="alert">{message}</div> : null}
      <button type="submit" disabled={busy}>
        {busy ? <LoaderCircle className={styles.spin} size={16} /> : <Mail size={16} />}
        {l("Send reset link", "Envoyer le lien")}
      </button>
      <Link className={styles.recoveryBack} href="/sign-in">
        <ArrowLeft size={13} />
        {l("Back to sign in", "Retour à la connexion")}
      </Link>
    </form>
  );
}
