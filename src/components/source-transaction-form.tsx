"use client";

import { Calculator, LoaderCircle, Plus, ReceiptText, X } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { createSourceTransaction, type TransactionActionState } from "@/app/app/transactions/actions";
import styles from "./live.module.css";

const initialTransactionState: TransactionActionState = { status: "idle", message: "" };
const rates=[17,14,8,3,0];
function money(v:number){return new Intl.NumberFormat("en-LU",{style:"currency",currency:"EUR",minimumFractionDigits:2}).format(v||0)}

export function SourceTransactionForm({defaultDate}:{defaultDate?:string}){
 const[state,formAction,pending]=useActionState(createSourceTransaction,initialTransactionState),[open,setOpen]=useState(false),today=defaultDate||new Date().toISOString().slice(0,10);
 const[amount,setAmount]=useState(0),[rate,setRate]=useState(17),[included,setIncluded]=useState(true),[treatment,setTreatment]=useState("domestic");
 const calc=useMemo(()=>{if(!amount)return{net:0,vat:0,gross:0};if(treatment==="eu_b2b_reverse_charge"){const vat=amount*rate/100;return{net:amount,vat,gross:amount}}if(treatment==="non_eu"||treatment==="exempt_or_zero"||rate===0)return{net:amount,vat:0,gross:amount};if(included){const net=amount/(1+rate/100);return{net,vat:amount-net,gross:amount}}const vat=amount*rate/100;return{net:amount,vat,gross:amount+vat}},[amount,rate,included,treatment]);
 useEffect(()=>{if(state.status==="success")setOpen(false)},[state.status]);
 return <>
  <button className="compta-fab" type="button" onClick={()=>setOpen(true)}><Plus size={17}/>New transaction</button>
  {open?<div className="compta-drawer-overlay" role="presentation" onMouseDown={e=>{if(e.currentTarget===e.target)setOpen(false)}}><div className="compta-drawer-shell"><button className="compta-drawer-close" type="button" onClick={()=>setOpen(false)} aria-label="Close new transaction"><X size={18}/></button><aside className={`${styles.formPanel} compta-drawer-card`}>
   <p className={styles.eyebrow}>Record activity</p><h2>New transaction</h2><p>Tell Compta what happened. VAT treatment controls how the ledger and filing evidence are created.</p>
   <form action={formAction} className={styles.transactionForm}>
    <label className={styles.field}><span>Type</span><select name="direction" defaultValue="expense" required><option value="expense">Expense</option><option value="income">Income / refund</option></select></label>
    <label className={styles.field}><span>Date</span><input name="occurred_on" type="date" defaultValue={today} required/></label>
    <label className={`${styles.field} ${styles.fieldFull}`}><span>VAT treatment</span><select name="vat_treatment" value={treatment} onChange={e=>setTreatment(e.target.value)}><option value="domestic">Luxembourg domestic VAT</option><option value="eu_b2b_reverse_charge">EU B2B · reverse charge</option><option value="non_eu">Non-EU / import evidence</option><option value="exempt_or_zero">Exempt / zero-rated</option><option value="unknown">Not sure · review later</option></select></label>
    <label className={styles.field}><span>Amount</span><input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required onChange={e=>setAmount(Number(e.target.value)||0)}/></label>
    <label className={styles.field}><span>{treatment==="eu_b2b_reverse_charge"?"Notional VAT rate":"VAT rate"}</span><select name="vat_rate" value={rate} onChange={e=>setRate(Number(e.target.value))}>{rates.map(r=><option key={r} value={r}>{r}%</option>)}</select></label>
    {treatment==="domestic"?<label className={`${styles.field} ${styles.fieldFull}`}><span>Does the amount include VAT?</span><select name="vat_included" value={included?"yes":"no"} onChange={e=>setIncluded(e.target.value==="yes")}><option value="yes">Yes · amount is TTC / gross</option><option value="no">No · amount is HT / net</option></select></label>:<input type="hidden" name="vat_included" value="no"/>}
    <div className={`${styles.formMessage} ${styles.fieldFull}`}><Calculator size={14}/> Net {money(calc.net)} · {treatment==="eu_b2b_reverse_charge"?"self-assessed VAT": "VAT"} {money(calc.vat)} · Cash {money(calc.gross)}</div>
    <label className={styles.field}><span>Customer / supplier</span><input name="counterparty_name" placeholder="e.g. Adobe, Upwork, client name"/></label>
    <label className={styles.field}><span>Country</span><input name="counterparty_country" maxLength={2} placeholder="LU / FR / US" style={{textTransform:"uppercase"}}/></label>
    <label className={`${styles.field} ${styles.fieldFull}`}><span>Description</span><textarea name="description" placeholder="What was this transaction for?"/></label>
    {state.message?<div className={`${styles.formMessage} ${styles.fieldFull} ${state.status==="error"?styles.formError:""}`}>{state.message}</div>:null}
    <button className={styles.submitButton} type="submit" disabled={pending}>{pending?<LoaderCircle size={15}/>:state.status==="success"?<ReceiptText size={15}/>:<Plus size={15}/>}<span>{pending?"Recording…":"Record transaction"}</span></button>
   </form>
  </aside></div></div>:null}
 </>;
}
