"use client";

import { LoaderCircle, MailPlus } from "lucide-react";
import { useActionState } from "react";
import { inviteTeamMemberAction, type TeamActionState } from "@/app/app/settings/team/actions";
import styles from "@/app/app/settings/team/team.module.css";

const initialState:TeamActionState={status:"idle",message:""};

export function TeamInviteForm(){
 const[state,action,pending]=useActionState(inviteTeamMemberAction,initialState);
 return <form action={action} className={styles.inviteForm}>
  <label><span>Email address</span><input type="email" name="email" placeholder="colleague@company.lu" required disabled={pending}/></label>
  <label><span>Role</span><select name="role" defaultValue="bookkeeper" disabled={pending}><option value="admin">Admin</option><option value="accountant">Accountant</option><option value="bookkeeper">Bookkeeper</option><option value="viewer">Viewer</option></select></label>
  <button type="submit" disabled={pending}>{pending?<LoaderCircle className={styles.spin} size={15}/>:<MailPlus size={15}/>} {pending?"Sending…":"Send invitation"}</button>
  {state.message?<p className={state.status==="error"?styles.error:styles.success}>{state.message}</p>:null}
 </form>
}
