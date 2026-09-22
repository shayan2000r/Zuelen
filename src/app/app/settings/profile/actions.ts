"use server";

import { revalidatePath } from "next/cache";
import { normalizeLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { userFacingDataError } from "@/lib/user-facing-error";

export type ProfileState={status:"idle"|"success"|"error";message:string};
const allowedTypes=new Set(["image/jpeg","image/png","image/webp"]);

export async function savePersonalProfile(_previous:ProfileState,formData:FormData):Promise<ProfileState>{
 const workspace=await getWorkspace();
 if(!workspace.authenticated||!workspace.userId)return{status:"error",message:"Your session expired. Please sign in again."};
 const fullName=String(formData.get("full_name")??"").trim();
 const requestedEmail=String(formData.get("email")??"").trim().toLowerCase();
 const locale=normalizeLocale(formData.get("locale"));
 const fr=locale==="fr";
 if(fullName.length>120)return{status:"error",message:fr?"Votre nom doit contenir moins de 120 caractères.":"Keep your name under 120 characters."};
 if(!requestedEmail||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedEmail))return{status:"error",message:fr?"Saisissez une adresse e-mail valide.":"Enter a valid email address."};
 const supabase=await createClient();
 let avatarPath=workspace.profile?.avatar_path??null;
 const avatar=formData.get("avatar");
 if(avatar instanceof File&&avatar.size>0){
  if(!allowedTypes.has(avatar.type))return{status:"error",message:fr?"La photo de profil doit être au format JPG, PNG ou WebP.":"Profile images must be JPG, PNG or WebP."};
  if(avatar.size>5*1024*1024)return{status:"error",message:fr?"La photo de profil doit faire moins de 5 Mo.":"Profile images must be smaller than 5 MB."};
  const extension=avatar.type==="image/png"?"png":avatar.type==="image/webp"?"webp":"jpg";
  const nextPath=`${workspace.userId}/avatar.${extension}`;
  const bytes=Buffer.from(await avatar.arrayBuffer());
  const{error:uploadError}=await supabase.storage.from("user-avatars").upload(nextPath,bytes,{contentType:avatar.type,upsert:true,cacheControl:"3600"});
  if(uploadError)return{status:"error",message:`${fr?"Impossible d’importer la photo de profil":"Could not upload profile image"}: ${userFacingDataError(uploadError)}`};
  if(avatarPath&&avatarPath!==nextPath)await supabase.storage.from("user-avatars").remove([avatarPath]);
  avatarPath=nextPath;
 }
 const removeAvatar=formData.get("remove_avatar")==="yes";
 if(removeAvatar&&avatarPath){await supabase.storage.from("user-avatars").remove([avatarPath]);avatarPath=null;}
 const{error:profileError}=await supabase.from("user_profiles").upsert({user_id:workspace.userId,full_name:fullName||null,avatar_path:avatarPath,locale,updated_at:new Date().toISOString()},{onConflict:"user_id"});
 if(profileError)return{status:"error",message:userFacingDataError(profileError)};
 let emailMessage="";
 if(requestedEmail!==workspace.email?.toLowerCase()){
  const{error:emailError}=await supabase.auth.updateUser({email:requestedEmail});
  if(emailError)return{status:"error",message:`${fr?"Profil enregistré, mais le changement d’adresse e-mail n’a pas pu démarrer":"Profile saved, but the email change could not start"}: ${userFacingDataError(emailError)}`};
  emailMessage=fr?" Consultez votre boîte de réception pour confirmer la nouvelle adresse e-mail.":" Check your inbox to confirm the new email address before it becomes active.";
 }
 for(const path of["/app","/app/settings","/app/settings/profile","/app/settings/team"])revalidatePath(path);
 return{status:"success",message:`${fr?"Profil personnel enregistré.":"Personal profile saved."}${emailMessage}`};
}
