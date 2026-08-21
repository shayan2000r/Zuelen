"use client";

import { ArrowRight, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./auth.module.css";

export function SignInForm({nextPath=null}:{nextPath?:string|null}) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const destination=nextPath&&nextPath.startsWith("/")&&!nextPath.startsWith("//")?nextPath:null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const supabase = createClient();
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(destination??"/app");
        router.refresh();
      } else {
        const next=destination??"/setup";
        const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callback } });
        if (error) throw error;
        if (data.session) {
          router.push(next);
          router.refresh();
        } else {
          setMessage(destination?"Check your inbox to confirm your email. The confirmation link will return you to your invitation.":"Check your inbox to confirm your email. The confirmation link will return you to Zuelen setup.");
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.shell}>
      <section className={styles.storyPanel}>
        <div className={styles.storyTop}><img className={styles.logoMark} src="/zuelen-icon.png" alt="Zuelen" style={{background:"transparent",display:"block",objectFit:"contain"}} /><span>Zuelen</span></div>
        <div className={styles.storyContent}><p className={styles.overline}>Luxembourg business, under control.</p><h1>Your books, taxes and deadlines — finally in one place.</h1><p className={styles.storyLead}>Built for owner-operated Luxembourg companies that want clarity without becoming accountants.</p><div className={styles.storyProofs}><div><span><Check size={13} /></span><p><strong>One source of truth</strong><small>Bookkeeping feeds VAT, annual accounts and tax preparation.</small></p></div><div><span><ShieldCheck size={13} /></span><p><strong>Luxembourg-first</strong><small>Designed around PCN, eCDF, RCS, AED and ACD workflows.</small></p></div><div><span><Sparkles size={13} /></span><p><strong>Guided, not overwhelming</strong><small>Zuelen tells you what needs attention before it becomes a problem.</small></p></div></div></div>
        <div className={styles.storyFooter}><LockKeyhole size={13} />Financial data is isolated per company with row-level security.</div>
      </section>
      <section className={styles.formPanel}><div className={styles.formWrap}><div className={styles.formHeader}><span className={styles.formEyebrow}>{destination?"Team invitation":mode === "signin" ? "Welcome back" : "Create your workspace"}</span><h2>{destination?(mode==="signin"?"Sign in to accept your invitation":"Create your account to join"):mode === "signin" ? "Sign in to Zuelen" : "Start with your company"}</h2><p>{destination?"Use the email address that received the invitation.":mode === "signin" ? "Continue where you left off." : "Set up your account now. Your Luxembourg company profile comes next."}</p></div>
        <form className={styles.form} onSubmit={handleSubmit}><label><span>Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@company.lu" required /></label><label><span>Password</span><div className={styles.passwordWrap}><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} placeholder="At least 8 characters" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>{message ? <div className={styles.message}>{message}</div> : null}<button className={styles.submit} type="submit" disabled={loading}>{loading ? <LoaderCircle className={styles.spin} size={17} /> : null}<span>{mode === "signin" ? "Sign in" : "Create account"}</span>{!loading ? <ArrowRight size={16} /> : null}</button></form>
        <div className={styles.switchMode}><span>{mode === "signin" ? "New to Zuelen?" : "Already have an account?"}</span><button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(null); }}>{mode === "signin" ? "Create an account" : "Sign in"}</button></div>
      </div></section>
    </main>
  );
}