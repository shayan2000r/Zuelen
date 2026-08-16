"use client";

import { CheckCircle2, LoaderCircle, Settings2 } from "lucide-react";
import { useActionState } from "react";
import { saveVatProfile,type VatProfileState } from "@/app/app/taxes/actions";
import styles from "./taxes.module.css";

const initial:VatProfileState={status:"idle",message:""};
export function VatProfileCard({frequency,year}:{frequency:string|null;year:number}){
  const[state,action,pending]=useActionState(saveVatProfile,initial);
  return <article className={styles.profileCard}><div className={styles.profileHead}><div><p>Filing profile</p><h2>AED cadence</h2></div><Settings2 size={18}/></div><p className={styles.profileLead}>Use the frequency assigned to your company. Turnover thresholds guide the standard regime, but the AED can decide otherwise.</p><form action={action}><input type="hidden" name="year" value={year}/><label><span>VAT return frequency</span><select name="frequency" defaultValue={frequency??""} required><option value="" disabled>Select assigned frequency</option><option value="annual">Annual only</option><option value="quarterly">Quarterly + annual</option><option value="monthly">Monthly + annual</option></select></label><div className={styles.thresholds}><div><strong>&lt; €112k</strong><span>normally annual</span></div><div><strong>€112k–€620k</strong><span>normally quarterly</span></div><div><strong>&gt; €620k</strong><span>normally monthly</span></div></div>{state.message?<div className={state.status==="error"?styles.formError:styles.formSuccess}>{state.status==="success"?<CheckCircle2 size={13}/>:null}{state.message}</div>:null}<button type="submit" disabled={pending}>{pending?<LoaderCircle className={styles.spin} size={14}/>:<CheckCircle2 size={14}/>}Save & sync calendar</button></form></article>;
}
