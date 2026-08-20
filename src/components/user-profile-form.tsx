"use client";

import { Camera, Check, LoaderCircle, Mail, Trash2, UserRound } from "lucide-react";
import { useActionState, useState } from "react";
import { savePersonalProfile, type ProfileState } from "@/app/app/settings/profile/actions";
import styles from "@/app/app/settings/profile/profile.module.css";

const initial:ProfileState={status:"idle",message:""};

export function UserProfileForm({email,fullName,avatarUrl,role}:{email:string;fullName:string;avatarUrl:string|null;role:string}){
 const[state,action,pending]=useActionState(savePersonalProfile,initial);
 const[preview,setPreview]=useState<string|null>(avatarUrl),[remove,setRemove]=useState(false);
 function onImage(file:File|null){if(!file)return;setRemove(false);setPreview(URL.createObjectURL(file));}
 return <form action={action} className={styles.form}>
  <section className={styles.card}><div className={styles.cardHead}><div><p>Personal identity</p><h2>Profile photo</h2></div><span>Visible to people in your organization</span></div><div className={styles.avatarArea}><div className={styles.avatar}>{preview&&!remove?<img src={preview} alt="Your profile"/>:<UserRound size={28}/>}</div><div><strong>Choose a clear profile image</strong><p>This is your personal avatar. It is separate from the company logo and is used in your account navigation.</p><div className={styles.avatarActions}><label><Camera size={14}/>Upload image<input name="avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>onImage(e.target.files?.[0]??null)}/></label>{(preview||avatarUrl)&&!remove?<button type="button" onClick={()=>{setRemove(true);setPreview(null)}}><Trash2 size={13}/>Remove</button>:null}</div>{remove?<input type="hidden" name="remove_avatar" value="yes"/>:null}</div></div></section>
  <section className={styles.card}><div className={styles.cardHead}><div><p>Account</p><h2>Your details</h2></div><span>Role: {role}</span></div><div className={styles.fields}><label><span><UserRound size={13}/>Full name</span><input name="full_name" defaultValue={fullName} placeholder="Your name" autoComplete="name"/></label><label><span><Mail size={13}/>Email address</span><input name="email" type="email" defaultValue={email} autoComplete="email" required/><small>Changing your email requires confirmation before it becomes active.</small></label></div></section>
  <div className={styles.saveBar}>{state.message?<span className={state.status==="error"?styles.error:styles.success}>{state.message}</span>:<span>Your personal profile follows you across organizations.</span>}<button type="submit" disabled={pending}>{pending?<LoaderCircle className={styles.spin} size={15}/>:<Check size={15}/>} {pending?"Saving…":"Save profile"}</button></div>
 </form>;
}
