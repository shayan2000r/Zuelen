"use client";

import { ArrowRight, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { currentUserRequiresMfa } from "@/lib/mfa-assurance";
import { safeInternalDestination } from "@/lib/safe-navigation";
import styles from "./auth.module.css";
import extra from "./auth-security.module.css";
import mobile from "./auth-mobile.module.css";

export function SignInForm({ nextPath = null }: { nextPath?: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [locale, setLocale] = useState<"en" | "fr">("en");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const destination = safeInternalDestination(nextPath);
  const fr = locale === "fr";
  const l = (en: string, french: string) => fr ? french : en;

  async function continueWithGoogle() {
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const callback = new URL("/auth/callback", window.location.origin);
      if (destination) callback.searchParams.set("next", destination);
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback.toString() } });
      if (error) throw error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : l("Google sign-in could not start. Please try again.", "La connexion Google n’a pas pu démarrer. Veuillez réessayer."));
      setLoading(false);
    }
  }


  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const query = destination ? `?next=${encodeURIComponent(destination)}` : "";
        const requiresMfa = await currentUserRequiresMfa(supabase);
        router.push(requiresMfa ? `/auth/mfa${query}` : `/auth/resolve${query}`);
        router.refresh();
      } else {
        const next = destination ?? "/setup";
        const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callback, data: { locale } } });
        if (error) throw error;
        if (data.session) {
          router.push(next);
          router.refresh();
        } else {
          setMessage(l("Check your inbox to confirm your email. Your confirmation link will return you to Zuelen.", "Consultez votre boîte mail pour confirmer votre adresse. Le lien de confirmation vous ramènera dans Zuelen."));
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : l("Something went wrong. Please try again.", "Une erreur est survenue. Veuillez réessayer."));
    } finally {
      setLoading(false);
    }
  }

  return <main className={`${styles.shell} ${mobile.authShell}`}>
    <section className={`${styles.storyPanel} ${mobile.storyPanel}`}>
      <div className={`${styles.storyTop} ${mobile.storyTop}`}><Image className={styles.logoMark} src="/zuelen-icon.png" alt="Zuelen" width={34} height={34}/><span>Zuelen</span></div>
      <div className={`${styles.storyContent} ${mobile.storyContent}`}>
        <p className={styles.overline}>{l("Luxembourg business, under control.", "Votre activité luxembourgeoise, sous contrôle.")}</p>
        <h1>{l("One secure account for every way you work.", "Un compte sécurisé pour toutes vos activités.")}</h1>
        <p className={styles.storyLead}>{l("Manage an Independent activity, a company, or your accounting-professional presence without separate credentials.", "Gérez une activité indépendante, une société ou votre présence de professionnel comptable sans multiplier les identifiants.")}</p>
        <div className={styles.storyProofs}>
          <div><span><Check size={13}/></span><p><strong>{l("One identity", "Une seule identité")}</strong><small>{l("Add activities and professional contexts whenever you need them.", "Ajoutez des activités et des contextes professionnels quand vous en avez besoin.")}</small></p></div>
          <div><span><ShieldCheck size={13}/></span><p><strong>{l("Isolated workspaces", "Espaces isolés")}</strong><small>{l("Every activity keeps its own books, access and subscription.", "Chaque activité conserve sa comptabilité, ses accès et son abonnement.")}</small></p></div>
          <div><span><Sparkles size={13}/></span><p><strong>{l("Luxembourg-first", "Pensé pour le Luxembourg")}</strong><small>{l("Accounting, VAT, CCSS and compliance adapt to your situation.", "Comptabilité, TVA, CCSS et obligations s’adaptent à votre situation.")}</small></p></div>
        </div>
      </div>
      <div className={styles.storyFooter}><LockKeyhole size={13}/>{l("Financial data is protected by organization-level row security.", "Les données financières sont protégées par une sécurité au niveau de chaque organisation.")}</div>
    </section>
    <section className={`${styles.formPanel} ${mobile.formPanel}`}>
      <div className={`${styles.formWrap} ${mobile.formWrap}`}>
        <div className={mobile.mobileAuthTop}><span><Image className={styles.logoMark} src="/zuelen-icon.png" alt="" width={31} height={31}/><strong>Zuelen</strong></span><div className={extra.languageSwitch} aria-label={l("Language", "Langue")}><button type="button" onClick={() => setLocale("en")} aria-pressed={!fr}>EN</button><button type="button" onClick={() => setLocale("fr")} aria-pressed={fr}>FR</button></div></div>
        <div className={mobile.desktopLanguage}><div className={extra.languageSwitch} aria-label={l("Language", "Langue")}><button type="button" onClick={() => setLocale("en")} aria-pressed={!fr}>EN</button><button type="button" onClick={() => setLocale("fr")} aria-pressed={fr}>FR</button></div></div>
        <div className={styles.formHeader}>
          <span className={styles.formEyebrow}>{destination ? l("Secure invitation", "Invitation sécurisée") : mode === "signin" ? l("Welcome back", "Bon retour") : l("Your Zuelen identity", "Votre identité Zuelen")}</span>
          <h2>{mode === "signin" ? l("Sign in to Zuelen", "Se connecter à Zuelen") : l("Create your Zuelen account", "Créer votre compte Zuelen")}</h2>
          <p>{destination ? l("Sign in with the email address that received the invitation.", "Connectez-vous avec l’adresse e-mail ayant reçu l’invitation.") : mode === "signin" ? l("Zuelen will open the right workspace or professional context.", "Zuelen ouvrira le bon espace ou contexte professionnel.") : l("After verification, choose what you would like to set up.", "Après vérification, choisissez ce que vous souhaitez configurer.")}</p>
        </div>
        <button className={extra.googleButton} type="button" onClick={continueWithGoogle} disabled={loading}>
          <svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.37l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.92A6.02 6.02 0 0 1 6.07 12c0-.67.12-1.31.32-1.92V7.46H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.54l3.35-2.62Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.82 1.49l2.87-2.87A9.61 9.61 0 0 0 12 2a10 10 0 0 0-8.96 5.46l3.35 2.62C7.18 7.71 9.39 5.95 12 5.95Z"/></svg>
          <span>{l("Continue with Google", "Continuer avec Google")}</span>
        </button>
        <div className={extra.authDivider}><span>{l("or use email", "ou utiliser l’e-mail")}</span></div>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label><span>{l("Email address", "Adresse e-mail")}</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.lu" required/></label>
          <label><span>{l("Password", "Mot de passe")}</span><div className={styles.passwordWrap}><input type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} placeholder={l("At least 8 characters", "Au moins 8 caractères")} required/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? l("Hide password", "Masquer le mot de passe") : l("Show password", "Afficher le mot de passe")}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div>{mode === "signin" ? <a className={extra.forgotButton} href={`/forgot-password?lang=${locale}`} target="_blank" rel="noopener noreferrer">{l("Forgot your password?", "Mot de passe oublié ?")}</a> : null}</label>
          {message ? <div className={styles.message} role="status">{message}</div> : null}
          <button className={styles.submit} type="submit" disabled={loading}>{loading ? <LoaderCircle className={styles.spin} size={17}/> : null}<span>{mode === "signin" ? l("Sign in", "Se connecter") : l("Create account", "Créer un compte")}</span>{!loading ? <ArrowRight size={16}/> : null}</button>
        </form>
        <div className={styles.switchMode}><span>{mode === "signin" ? l("New to Zuelen?", "Nouveau sur Zuelen ?") : l("Already have an account?", "Vous avez déjà un compte ?")}</span><button type="button" onClick={() => { if (mode === "signin") { window.location.assign(fr ? "https://zuelen.lu/acces-anticipe" : "https://zuelen.lu/en/early-access"); return; } setMode("signin"); setMessage(null); }}>{mode === "signin" ? l("Create an account", "Créer un compte") : l("Sign in", "Se connecter")}</button></div>
      </div>
    </section>
  </main>;
}
