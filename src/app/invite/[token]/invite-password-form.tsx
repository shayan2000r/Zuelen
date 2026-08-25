"use client";

import { Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { acceptTeamInvitationAction } from "@/app/app/settings/team/actions";
import styles from "./invite.module.css";

export function InvitePasswordForm({token}:{token:string}){
 const[password,setPassword]=useState("");
 const[confirm,setConfirm]=useState("");
 const[show,setShow]=useState(false);
 const[busy,setBusy]=useState(false);
 const[message,setMessage]=useState<string|null>(null);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setMessage(null);
  if(password.length<8)return setMessage("Use at least 8 characters for your password.");
  if(password!==confirm)return setMessage("The passwords do not match.");
  setBusy(true);
  try{
   const supabase=createClient();
   const{error:passwordError}=await supabase.auth.updateUser({password});
   if(passwordError)throw passwordError;
   const formData=new FormData();formData.set("token",token);await acceptTeamInvitationAction(formData);
  }catch(error){setMessage(error instanceof Error?error.message:"Your access could not be activated.");setBusy(false)}
 }
 return <form className={styles.passwordForm} onSubmit={submit}><div className={styles.passwordIntro}><span><LockKeyhole size={16}/></span><div><strong>Create your Zuelen password</strong><small>Your email is confirmed. Choose the password you will use for future sign-ins.</small></div></div><label><span>Password</span><div className={styles.passwordField}><input type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} minLength={8} autoComplete="new-password" placeholder="At least 8 characters" required/><button type="button" onClick={()=>setShow(value=>!value)} aria-label={show?"Hide password":"Show password"}>{show?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label><label><span>Confirm password</span><input type={show?"text":"password"} value={confirm} onChange={e=>setConfirm(e.target.value)} minLength={8} autoComplete="new-password" placeholder="Repeat your password" required/></label>{message?<p className={styles.error}>{message}</p>:null}<button className={styles.accept} type="submit" disabled={busy}>{busy?<LoaderCircle className={styles.spin} size={16}/>:null}{busy?"Activating access…":"Create password & join"}</button></form>;
}
