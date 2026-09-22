"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { seatLimitMessage } from "@/lib/billing";
import { allowEarlyAccessEmail } from "@/lib/early-access";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE, getWorkspace } from "@/lib/workspace";
import { userFacingDataError } from "@/lib/user-facing-error";

export type TeamActionState={status:"idle"|"success"|"error";message:string};
const ROLES=new Set(["admin","accountant","bookkeeper","viewer"]);
function roleLabel(role:string){return role.charAt(0).toUpperCase()+role.slice(1)}
function refreshTeam(){revalidatePath("/app/settings/team");revalidatePath("/app/settings/usage");revalidatePath("/app/settings/billing")}

export async function inviteTeamMemberAction(_previous:TeamActionState,formData:FormData):Promise<TeamActionState>{
 const workspace=await getWorkspace();
 if(!workspace.authenticated||!workspace.organization)return{status:"error",message:"Your session expired. Please sign in again."};
 const email=String(formData.get("email")??"").trim().toLowerCase(),role=String(formData.get("role")??"");
 if(!email||!email.includes("@"))return{status:"error",message:"Enter a valid email address."};
 if(!ROLES.has(role))return{status:"error",message:"Choose a valid role."};
 const supabase=await createClient();
 const{data,error}=await supabase.rpc("create_organization_invitation",{p_organization_id:workspace.organization.id,p_email:email,p_role:role});
 if(error)return{status:"error",message:seatLimitMessage(new Error(error.message),workspace.profile?.locale==="fr"?"fr":"en")??userFacingDataError(error)};
 const invite=Array.isArray(data)?data[0]:null;
 if(!invite?.token)return{status:"error",message:"The invitation could not be created."};
 const requestHeaders=await headers(),host=requestHeaders.get("x-forwarded-host")||requestHeaders.get("host"),proto=requestHeaders.get("x-forwarded-proto")||"https";
 const origin=host?`${proto}://${host}`:process.env.NEXT_PUBLIC_APP_URL||"http://localhost:3000";
 const next=`/invite/${invite.token}`;
 const callback=`${origin}/auth/complete?next=${encodeURIComponent(next)}`;
 const{error:mailError}=await supabase.auth.signInWithOtp({email,options:{shouldCreateUser:true,emailRedirectTo:callback}});
 if(mailError){
  await supabase.rpc("revoke_organization_invitation",{p_organization_id:workspace.organization.id,p_invitation_id:invite.id});
  return{status:"error",message:`Invitation email could not be sent: ${userFacingDataError(mailError)}`};
 }
 await allowEarlyAccessEmail(email,"manual");
 refreshTeam();
 return{status:"success",message:`Invitation sent to ${email} as ${roleLabel(role)}.`};
}

export async function updateTeamMemberRoleAction(formData:FormData){
 const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.organization)throw new Error("Your session expired.");
 const userId=String(formData.get("user_id")??""),role=String(formData.get("role")??"");if(!ROLES.has(role))throw new Error("Invalid role.");
 const supabase=await createClient(),{error}=await supabase.rpc("update_organization_member_role",{p_organization_id:workspace.organization.id,p_user_id:userId,p_role:role});if(error)throw new Error(userFacingDataError(error));refreshTeam();
}

export async function removeTeamMemberAction(formData:FormData){
 const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.organization)throw new Error("Your session expired.");
 const userId=String(formData.get("user_id")??"");const supabase=await createClient(),{error}=await supabase.rpc("remove_organization_member",{p_organization_id:workspace.organization.id,p_user_id:userId});if(error)throw new Error(userFacingDataError(error));refreshTeam();
}

export async function revokeTeamInvitationAction(formData:FormData){
 const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.organization)throw new Error("Your session expired.");
 const id=String(formData.get("invitation_id")??"");const supabase=await createClient(),{error}=await supabase.rpc("revoke_organization_invitation",{p_organization_id:workspace.organization.id,p_invitation_id:id});if(error)throw new Error(userFacingDataError(error));refreshTeam();
}

export async function acceptTeamInvitationAction(formData:FormData){
 const token=String(formData.get("token")??"");if(!token)redirect("/sign-in");const supabase=await createClient();const invitationResult=await supabase.rpc("get_organization_invitation_v2",{p_token:token});const invitation=Array.isArray(invitationResult.data)?invitationResult.data[0]:null;if(invitationResult.error||!invitation?.organization_id)redirect(`/invite/${encodeURIComponent(token)}?error=${encodeURIComponent(invitationResult.error?.message??"Invitation unavailable")}`);const{error}=await supabase.rpc("accept_organization_invitation",{p_token:token});if(error)redirect(`/invite/${encodeURIComponent(token)}?error=${encodeURIComponent(error.message)}`);const{data:company}=await supabase.from("companies").select("id").eq("organization_id",invitation.organization_id).order("created_at",{ascending:true}).limit(1).maybeSingle();if(company?.id)(await cookies()).set(ACTIVE_WORKSPACE_COOKIE,company.id,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*24*365});redirect("/app");
}
