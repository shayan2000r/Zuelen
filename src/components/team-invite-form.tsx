"use client";

import { LoaderCircle, MailPlus } from "lucide-react";
import { useActionState } from "react";
import { inviteTeamMemberAction, type TeamActionState } from "@/app/app/settings/team/actions";
import { useI18n } from "@/components/locale-context";
import { localizedRole } from "@/lib/i18n";
import styles from "@/app/app/settings/team/team.module.css";

const initialState:TeamActionState={status:"idle",message:""};

export function TeamInviteForm(){
 const[state,action,pending]=useActionState(inviteTeamMemberAction,initialState),{locale}=useI18n(),fr=locale==="fr";
 return <form action={action} className={styles.inviteForm}>
  <label><span>{fr?"Adresse e-mail":"Email address"}</span><input type="email" name="email" placeholder="colleague@company.lu" required disabled={pending}/></label>
  <label><span>{fr?"Rôle":"Role"}</span><select name="role" defaultValue="bookkeeper" disabled={pending}><option value="admin">{localizedRole(locale,"admin")}</option><option value="accountant">{localizedRole(locale,"accountant")}</option><option value="bookkeeper">{localizedRole(locale,"bookkeeper")}</option><option value="viewer">{localizedRole(locale,"viewer")}</option></select></label>
  <button type="submit" disabled={pending}>{pending?<LoaderCircle className={styles.spin} size={15}/>:<MailPlus size={15}/>} {pending?(fr?"Envoi…":"Sending…"):(fr?"Envoyer l’invitation":"Send invitation")}</button>
  {state.message?<p className={state.status==="error"?styles.error:styles.success}>{state.message}</p>:null}
 </form>
}
