"use client";

import { Camera, Check, Languages, LoaderCircle, Mail, Trash2, UserRound } from "lucide-react";
import { useActionState, useState } from "react";
import { savePersonalProfile, type ProfileState } from "@/app/app/settings/profile/actions";
import { useI18n } from "@/components/locale-context";
import type { Locale } from "@/lib/i18n";
import styles from "@/app/app/settings/profile/profile.module.css";

const initial:ProfileState={status:"idle",message:""};

export function UserProfileForm({email,fullName,avatarUrl,role,locale}:{email:string;fullName:string;avatarUrl:string|null;role:string;locale:Locale}){
 const[state,action,pending]=useActionState(savePersonalProfile,initial),i18n=useI18n(),fr=i18n.locale==="fr";
 const[preview,setPreview]=useState<string|null>(avatarUrl),[remove,setRemove]=useState(false);
 function onImage(file:File|null){if(!file)return;setRemove(false);setPreview(URL.createObjectURL(file));}
 return <form action={action} className={styles.form}>
  <section className={styles.card}><div className={styles.cardHead}><div><p>{i18n.t("personalIdentity")}</p><h2>{i18n.t("profilePhoto")}</h2></div><span>{fr?"Visible par les membres de votre organisation":"Visible to people in your organization"}</span></div><div className={styles.avatarArea}><div className={styles.avatar}>{preview&&!remove?<img src={preview} alt={fr?"Votre profil":"Your profile"}/>:<UserRound size={28}/>}</div><div><strong>{fr?"Choisissez une photo de profil claire":"Choose a clear profile image"}</strong><p>{fr?"Il s’agit de votre avatar personnel. Il est distinct du logo de l’entreprise et apparaît dans la navigation de votre compte.":"This is your personal avatar. It is separate from the company logo and is used in your account navigation."}</p><div className={styles.avatarActions}><label><Camera size={14}/>{fr?"Importer une image":"Upload image"}<input name="avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>onImage(e.target.files?.[0]??null)}/></label>{(preview||avatarUrl)&&!remove?<button type="button" onClick={()=>{setRemove(true);setPreview(null)}}><Trash2 size={13}/>{fr?"Supprimer":"Remove"}</button>:null}</div>{remove?<input type="hidden" name="remove_avatar" value="yes"/>:null}</div></div></section>
  <section className={styles.card}><div className={styles.cardHead}><div><p>{fr?"Compte":"Account"}</p><h2>{i18n.t("yourDetails")}</h2></div><span>{fr?"Rôle":"Role"}: {role}</span></div><div className={styles.fields}><label><span><UserRound size={13}/>{i18n.t("fullName")}</span><input name="full_name" defaultValue={fullName} placeholder={fr?"Votre nom":"Your name"} autoComplete="name"/></label><label><span><Mail size={13}/>{i18n.t("emailAddress")}</span><input name="email" type="email" defaultValue={email} autoComplete="email" required/><small>{fr?"Le changement d’adresse e-mail doit être confirmé avant de devenir actif.":"Changing your email requires confirmation before it becomes active."}</small></label><label><span><Languages size={13}/>{i18n.t("language")}</span><select name="locale" defaultValue={locale}><option value="en">English</option><option value="fr">Français</option></select><small>{fr?"Cette préférence s’applique à l’interface, aux comptes PCN et aux documents financiers générés.":"This preference applies to the interface, PCN account names and generated financial documents."}</small></label></div></section>
  <div className={styles.saveBar}>{state.message?<span className={state.status==="error"?styles.error:styles.success}>{state.message}</span>:<span>{fr?"Votre profil personnel vous suit dans toutes les organisations.":"Your personal profile follows you across organizations."}</span>}<button type="submit" disabled={pending}>{pending?<LoaderCircle className={styles.spin} size={15}/>:<Check size={15}/>} {pending?i18n.t("saving"):i18n.t("saveProfile")}</button></div>
 </form>;
}
