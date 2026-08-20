"use client";

import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./auth-complete.module.css";

function safeNext(value:string){return value.startsWith("/")&&!value.startsWith("//")?value:"/app"}

export function AuthComplete({nextPath}:{nextPath:string}){
 const router=useRouter();
 const[message,setMessage]=useState("Securing your invitation…");
 useEffect(()=>{
  let active=true;
  async function complete(){
   const supabase=createClient();
   try{
    let{data:{session}}=await supabase.auth.getSession();
    if(!session){
     const hash=new URLSearchParams(window.location.hash.replace(/^#/,""));
     const accessToken=hash.get("access_token"),refreshToken=hash.get("refresh_token");
     if(accessToken&&refreshToken){
      const{data,error}=await supabase.auth.setSession({access_token:accessToken,refresh_token:refreshToken});
      if(error)throw error;
      session=data.session;
     }
    }
    if(!session){
     const code=new URLSearchParams(window.location.search).get("code");
     if(code){
      const{data,error}=await supabase.auth.exchangeCodeForSession(code);
      if(error)throw error;
      session=data.session;
     }
    }
    if(!session)throw new Error("The invitation link could not create a secure session.");
    if(!active)return;
    window.history.replaceState({},"",`/auth/complete?next=${encodeURIComponent(nextPath)}`);
    setMessage("Email confirmed. Preparing your access…");
    router.replace(safeNext(nextPath));
    router.refresh();
   }catch(error){
    if(!active)return;
    setMessage(error instanceof Error?error.message:"The invitation could not be completed.");
    window.setTimeout(()=>router.replace(`/sign-in?next=${encodeURIComponent(safeNext(nextPath))}`),1800);
   }
  }
  void complete();
  return()=>{active=false};
 },[nextPath,router]);
 return <main className={styles.shell}><section className={styles.card}><div className={styles.brand}><span>C</span>Compta</div><div className={styles.icon}><ShieldCheck size={23}/></div><h1>Confirming your invitation</h1><p>{message}</p><LoaderCircle className={styles.spin} size={20}/></section></main>;
}
