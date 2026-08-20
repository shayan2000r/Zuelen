import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { acceptTeamInvitationAction } from "@/app/app/settings/team/actions";
import styles from "./invite.module.css";

export const dynamic="force-dynamic";
function pretty(role:string){return role.charAt(0).toUpperCase()+role.slice(1)}
function validToken(value:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)}

export default async function InvitationPage({params,searchParams}:{params:Promise<{token:string}>;searchParams:Promise<{error?:string}>}){
 const{token}=await params,{error:queryError}=await searchParams;if(!validToken(token))redirect("/sign-in");
 const workspace=await getWorkspace();if(!workspace.authenticated)redirect(`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`);
 const supabase=await createClient(),{data,error}=await supabase.rpc("get_organization_invitation",{p_token:token});
 const invitation=Array.isArray(data)?data[0]:null;
 return <main className={styles.shell}><section className={styles.card}><div className={styles.brand}><span className={styles.mark}>C</span>Compta</div>{invitation&&!error?<><p className={styles.eyebrow}>Team invitation</p><h1>Join {invitation.organization_name}</h1><p className={styles.lead}>You were invited to collaborate in this Compta organization. Access is granted only after you accept below.</p><div className={styles.details}><div className={styles.row}><span>Signed in as</span><strong>{workspace.email}</strong></div><div className={styles.row}><span>Organization</span><strong>{invitation.organization_name}</strong></div><div className={styles.row}><span>Role</span><strong>{pretty(invitation.role)}</strong></div><div className={styles.row}><span>Invitation expires</span><strong>{new Date(invitation.expires_at).toLocaleDateString("en-LU",{year:"numeric",month:"long",day:"numeric"})}</strong></div></div>{queryError?<p className={styles.error}>{queryError}</p>:null}<form action={acceptTeamInvitationAction}><input type="hidden" name="token" value={token}/><button className={styles.accept} type="submit">Accept invitation</button></form><p className={styles.signout}>Wrong account? <Link href="/auth/signout">Sign out</Link> and open the invitation again.</p></>:<div className={styles.expired}><p className={styles.eyebrow}>Invitation unavailable</p><h1>This invitation cannot be accepted.</h1><p>It may have expired, been revoked, already been used, or it may belong to a different email address.</p>{queryError?<p className={styles.error}>{queryError}</p>:null}</div>}</section></main>
}
