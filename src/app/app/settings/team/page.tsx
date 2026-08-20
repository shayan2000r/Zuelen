import Link from "next/link";
import { ArrowLeft, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { TeamInviteForm } from "@/components/team-invite-form";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { removeTeamMemberAction, revokeTeamInvitationAction, updateTeamMemberRoleAction } from "./actions";
import styles from "./team.module.css";

export const dynamic="force-dynamic";
const roleCopy={owner:"Full control, including ownership and organization access.",admin:"Full operational access plus team management.",accountant:"Accounting, tax, year-end and reporting access without team administration.",bookkeeper:"Day-to-day bookkeeping access for transactions, banking, documents and invoices.",viewer:"Read-only access to the organization."} as const;
const editableRoles=["admin","accountant","bookkeeper","viewer"] as const;
function initial(email:string){return(email.trim().charAt(0)||"?").toUpperCase()}
function pretty(role:string){return role.charAt(0).toUpperCase()+role.slice(1)}

export default async function TeamSettingsPage(){
 const workspace=await getWorkspace();if(!workspace.authenticated)redirect("/sign-in");if(!workspace.organization||!workspace.company)redirect("/setup");
 const supabase=await createClient();
 const{data:members,error:memberError}=await supabase.rpc("list_organization_team",{p_organization_id:workspace.organization.id});
 if(memberError)throw new Error(memberError.message);
 const current=(members??[]).find((m:{user_id:string})=>m.user_id===workspace.userId),currentRole=String(current?.role??"viewer"),canManage=currentRole==="owner"||currentRole==="admin";
 let invitations:unknown[]=[];if(canManage){const result=await supabase.rpc("list_organization_invitations",{p_organization_id:workspace.organization.id});if(result.error)throw new Error(result.error.message);invitations=result.data??[]}
 return <main className={styles.page}>
  <Link href="/app/settings" className={styles.back}><ArrowLeft size={13}/>Company settings</Link>
  <header className={styles.intro}><div><p>Settings · access control</p><h1>Team & Access</h1><h2>Invite people into {workspace.company.trading_name||workspace.company.legal_name}, assign the right level of access, and remove access when it is no longer needed.</h2></div><span className={styles.rolePill}><ShieldCheck size={13}/>Your role: {pretty(currentRole)}</span></header>
  <div className={styles.grid}><div>
   {canManage?<section className={styles.card}><div className={styles.cardHead}><div><p>Invite</p><h2>Add a team member</h2></div><span>Invitation expires after 7 days</span></div><div className={styles.inviteWrap}><TeamInviteForm/></div></section>:null}
   <section className={styles.card} style={{marginTop:12}}><div className={styles.cardHead}><div><p>Members</p><h2>People with access</h2></div><span>{(members??[]).length} member{(members??[]).length===1?"":"s"}</span></div><div className={styles.memberList}>{(members??[]).map((member:{user_id:string;email:string;role:string;joined_at:string;is_owner:boolean})=><div className={styles.memberRow} key={member.user_id}><div className={styles.identity}><span className={styles.avatar}>{initial(member.email)}</span><div><strong>{member.email}{member.user_id===workspace.userId?" · You":""}</strong><small>Joined {new Date(member.joined_at).toLocaleDateString("en-LU",{year:"numeric",month:"short",day:"numeric"})}</small>{member.is_owner?<span className={styles.ownerBadge}>Organization owner</span>:null}</div></div><div>{canManage&&!member.is_owner?<form action={updateTeamMemberRoleAction} className={styles.roleForm}><input type="hidden" name="user_id" value={member.user_id}/><select name="role" defaultValue={member.role}>{editableRoles.map(role=><option key={role} value={role}>{pretty(role)}</option>)}</select><button className={styles.smallButton} type="submit">Save</button></form>:<span className={styles.memberRole}>{pretty(member.role)}</span>}</div><div className={styles.actions}>{canManage&&!member.is_owner&&member.user_id!==workspace.userId?<form action={removeTeamMemberAction}><input type="hidden" name="user_id" value={member.user_id}/><button type="submit" className={styles.dangerButton}><Trash2 size={12}/>Remove</button></form>:null}</div></div>)}</div></section>
   {canManage?<section className={styles.card} style={{marginTop:12}}><div className={styles.cardHead}><div><p>Pending</p><h2>Invitations</h2></div><span>{invitations.length} active</span></div><div className={styles.inviteList}>{invitations.length?invitations.map((raw)=>{const invite=raw as {id:string;email:string;role:string;status:string;created_at:string;expires_at:string};return <div className={styles.inviteRow} key={invite.id}><div className={styles.identity}><span className={styles.avatar}>{initial(invite.email)}</span><div><strong>{invite.email}</strong><small>Invited as {pretty(invite.role)} · expires {new Date(invite.expires_at).toLocaleDateString("en-LU",{month:"short",day:"numeric",year:"numeric"})}</small><span className={styles.pendingBadge}>{pretty(invite.status)}</span></div></div><span className={styles.memberRole}>{pretty(invite.role)}</span><div className={styles.actions}>{invite.status==="pending"?<form action={revokeTeamInvitationAction}><input type="hidden" name="invitation_id" value={invite.id}/><button type="submit" className={styles.dangerButton}>Revoke</button></form>:null}</div></div>}):<div className={styles.empty}>No pending invitations.</div>}</div></section>:null}
  </div><aside><section className={styles.card}><div className={styles.cardHead}><div><p>Roles</p><h2>Permission levels</h2></div><UsersRound size={16}/></div><div className={styles.permissions}>{Object.entries(roleCopy).map(([role,copy])=><div className={styles.permission} key={role}><strong>{pretty(role)}</strong><p>{copy}</p></div>)}</div></section><div className={styles.note}><strong>Security model.</strong> Permissions are enforced in Supabase row-level security and controlled database functions, not only by hiding UI controls.</div></aside></div>
 </main>
}
