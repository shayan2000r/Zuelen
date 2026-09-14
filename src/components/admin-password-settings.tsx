"use client";

import { Check, KeyRound, LoaderCircle } from "lucide-react";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./security-settings.module.css";

export function AdminPasswordSettings({ email }: { email: string }) {
  const [currentPassword,setCurrentPassword]=useState("");
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<string|null>(null);
  const [success,setSuccess]=useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSuccess(false);

    if (password.length < 10) return setMessage("Use at least 10 characters for the new admin password.");
    if (password !== confirm) return setMessage("The new passwords do not match.");
    if (currentPassword === password) return setMessage("Choose a new password different from the current one.");

    setBusy(true);
    try {
      const supabase=createClient();
      const { error: verifyError }=await supabase.auth.signInWithPassword({email,password:currentPassword});
      if (verifyError) throw new Error("Current password is incorrect.");

      const { error }=await supabase.auth.updateUser({password});
      if (error) throw error;

      setCurrentPassword("");
      setPassword("");
      setConfirm("");
      setSuccess(true);
    } catch(error) {
      setMessage(error instanceof Error ? error.message : "The password could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  return <section className={styles.securityCard}>
    <div className={styles.securityHead}>
      <span><KeyRound size={19}/></span>
      <div><p>Admin credentials</p><h2>Change password</h2></div>
      <em className={styles.enabled}>Protected</em>
    </div>
    <p className={styles.securityLead}>Confirm your current password before replacing it. The new password applies only to the contact@zuelen.lu admin identity.</p>
    <form className={styles.enrollment} onSubmit={submit}>
      <label><span>Current password</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required disabled={busy}/></label>
      <label><span>New password</span><input type="password" autoComplete="new-password" minLength={10} value={password} onChange={e=>setPassword(e.target.value)} required disabled={busy}/></label>
      <label><span>Confirm new password</span><input type="password" autoComplete="new-password" minLength={10} value={confirm} onChange={e=>setConfirm(e.target.value)} required disabled={busy}/></label>
      <div className={styles.enrollmentActions}><button type="submit" className={styles.primaryAction} disabled={busy}>{busy?<LoaderCircle className={styles.spin} size={15}/>:<Check size={15}/>}Change password</button></div>
    </form>
    {message?<div className={styles.error} role="alert">{message}</div>:null}
    {success?<div className={styles.notice} role="status">Admin password updated successfully.</div>:null}
  </section>;
}
