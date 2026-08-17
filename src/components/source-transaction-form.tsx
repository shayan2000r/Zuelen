"use client";

import { Calculator, LoaderCircle, Plus, ReceiptText, X } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { createSourceTransaction, type TransactionActionState } from "@/app/app/transactions/actions";
import styles from "./live.module.css";

const initialTransactionState: TransactionActionState = { status: "idle", message: "" };
const rates = [17,14,8,3,0];
function money(v:number){return new Intl.NumberFormat("en-LU",{style:"currency",currency:"EUR",minimumFractionDigits:2}).format(v||0)}

export function SourceTransactionForm() {
  const [state, formAction, pending] = useActionState(createSourceTransaction, initialTransactionState);
  const [open,setOpen]=useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [amount,setAmount]=useState(0);const [rate,setRate]=useState(17);const [included,setIncluded]=useState(true);
  const calc=useMemo(()=>{if(!amount||rate===0)return{net:amount||0,vat:0,gross:amount||0};if(included){const net=amount/(1+rate/100);return{net,vat:amount-net,gross:amount}}const vat=amount*rate/100;return{net:amount,vat,gross:amount+vat}},[amount,rate,included]);
  useEffect(()=>{if(state.status==="success")setOpen(false)},[state.status]);

  return <>
    <button className="compta-fab" type="button" onClick={()=>setOpen(true)}><Plus size={17}/>New transaction</button>
    {open?<div className="compta-drawer-overlay" role="presentation" onMouseDown={e=>{if(e.currentTarget===e.target)setOpen(false)}}><div className="compta-drawer-shell"><button className="compta-drawer-close" type="button" onClick={()=>setOpen(false)} aria-label="Close new transaction"><X size={18}/></button><aside className={`${styles.formPanel} compta-drawer-card`}>
      <p className={styles.eyebrow}>Record activity</p>
      <h2>New transaction</h2>
      <p>Enter the amount you know and choose the VAT treatment. Compta calculates the accounting split for you.</p>
      <form action={formAction} className={styles.transactionForm}>
        <label className={styles.field}><span>Type</span><select name="direction" defaultValue="expense" required><option value="expense">Expense</option><option value="income">Income</option></select></label>
        <label className={styles.field}><span>Date</span><input name="occurred_on" type="date" defaultValue={today} required /></label>
        <label className={styles.field}><span>Amount</span><input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required onChange={e=>setAmount(Number(e.target.value)||0)} /></label>
        <label className={styles.field}><span>VAT rate</span><select name="vat_rate" value={rate} onChange={e=>setRate(Number(e.target.value))}>{rates.map(r=><option key={r} value={r}>{r}%</option>)}</select></label>
        <label className={`${styles.field} ${styles.fieldFull}`}><span>Does the amount include VAT?</span><select name="vat_included" value={included?"yes":"no"} onChange={e=>setIncluded(e.target.value==="yes")}><option value="yes">Yes · amount is TTC / gross</option><option value="no">No · amount is HT / net</option></select></label>
        <div className={`${styles.formMessage} ${styles.fieldFull}`}><Calculator size={14}/> Net {money(calc.net)} · VAT {money(calc.vat)} · Total {money(calc.gross)}</div>
        <label className={`${styles.field} ${styles.fieldFull}`}><span>Customer / supplier</span><input name="counterparty_name" placeholder="e.g. Software supplier" /></label>
        <label className={`${styles.field} ${styles.fieldFull}`}><span>Description</span><textarea name="description" placeholder="What was this transaction for?" /></label>
        {state.message ? <div className={`${styles.formMessage} ${styles.fieldFull} ${state.status === "error" ? styles.formError : ""}`}>{state.message}</div> : null}
        <button className={styles.submitButton} type="submit" disabled={pending}>{pending ? <LoaderCircle size={15} /> : state.status === "success" ? <ReceiptText size={15} /> : <Plus size={15} />}<span>{pending ? "Recording…" : "Record transaction"}</span></button>
      </form>
    </aside></div></div>:null}
  </>;
}
