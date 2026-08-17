"use client";

import { AlertTriangle, CheckCircle2, DatabaseBackup, LoaderCircle, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { resetBookkeepingAction, resetFinancialYearAction, saveOpeningBalancesAction, type AccountingActionState } from "@/app/app/accounting/actions";
import styles from "./accounting-year-controls.module.css";

type Account={id:string;code:string;label:string;account_type:string};
type OpeningLine={id:number;account_id:string;debit:string;credit:string};
const initial:AccountingActionState={status:"idle",message:""};
function money(value:number,currency:string){return new Intl.NumberFormat("en-LU",{style:"currency",currency,minimumFractionDigits:2}).format(value||0)}

export function AccountingYearControls({year,currency,legalName,accounts,openingPosted}:{year:number;currency:string;legalName:string;accounts:Account[];openingPosted:boolean}){
 const router=useRouter(),openingDialog=useRef<HTMLDialogElement>(null),yearDialog=useRef<HTMLDialogElement>(null),allDialog=useRef<HTMLDialogElement>(null);
 const[openingState,openingAction,openingPending]=useActionState(saveOpeningBalancesAction,initial),[yearState,yearAction,yearPending]=useActionState(resetFinancialYearAction,initial),[allState,allAction,allPending]=useActionState(resetBookkeepingAction,initial);
 const[lines,setLines]=useState<OpeningLine[]>([{id:1,account_id:"",debit:"",credit:""},{id:2,account_id:"",debit:"",credit:""}]);
 const totals=useMemo(()=>lines.reduce((acc,line)=>({debit:acc.debit+(Number(line.debit)||0),credit:acc.credit+(Number(line.credit)||0)}),{debit:0,credit:0}),[lines]),balanced=totals.debit>0&&Math.abs(totals.debit-totals.credit)<.005;
 function update(id:number,patch:Partial<OpeningLine>){setLines(current=>current.map(line=>line.id===id?{...line,...patch}:line))}
 function add(){setLines(current=>[...current,{id:Date.now(),account_id:"",debit:"",credit:""}])}
 function remove(id:number){setLines(current=>current.length<=2?current:current.filter(line=>line.id!==id))}
 useEffect(()=>{if(openingState.status==="success"){openingDialog.current?.close();router.refresh()}},[openingState.status,router]);
 useEffect(()=>{if(yearState.status==="success"){yearDialog.current?.close();router.refresh()}},[yearState.status,router]);
 useEffect(()=>{if(allState.status==="success"){allDialog.current?.close();router.refresh()}},[allState.status,router]);
 const payload=lines.filter(line=>line.account_id&&(Number(line.debit)>0||Number(line.credit)>0)).map(line=>({account_id:line.account_id,debit:Number(line.debit)||0,credit:Number(line.credit)||0}));
 return <>
  <section className={styles.panel}>
   <div className={styles.copy}><span className={styles.icon}><DatabaseBackup size={18}/></span><div><strong>Financial year {year} test controls</strong><span>Set the opening balance sheet before testing the Bilan, or reset this year and run the full bookkeeping flow again.</span>{openingPosted?<span className={styles.posted}><CheckCircle2 size={11}/>Opening position posted</span>:null}</div></div>
   <div className={styles.actions}><button type="button" className={styles.primary} disabled={openingPosted} onClick={()=>openingDialog.current?.showModal()}><Plus size={13}/>{openingPosted?"Opening position added":"Add opening position"}</button><button type="button" className={styles.secondary} onClick={()=>yearDialog.current?.showModal()}><RotateCcw size={13}/>Reset FY {year}</button><button type="button" className={styles.danger} onClick={()=>allDialog.current?.showModal()}><Trash2 size={13}/>Clear all bookkeeping</button></div>
  </section>

  <dialog ref={openingDialog} className={styles.dialog}>
   <form action={openingAction} className={styles.card}>
    <div className={styles.head}><div><p>Opening position · FY {year}</p><h3>Enter the prior closing balances.</h3></div><button className={styles.close} type="button" onClick={()=>openingDialog.current?.close()} aria-label="Close"><X size={16}/></button></div>
    <p className={styles.lead}>For FY {year}, enter the balance-sheet position carried forward from the previous financial year. Use debit balances for assets and credit balances for liabilities/equity. Compta will only post the entry when total debits equal total credits.</p>
    <div className={styles.openingList}>{lines.map((line,index)=><div className={styles.openingRow} key={line.id}><label><span>Balance-sheet account</span><select value={line.account_id} onChange={e=>update(line.id,{account_id:e.target.value})} required><option value="">Choose account…</option>{accounts.map(account=><option value={account.id} key={account.id}>{account.code} · {account.label} · {account.account_type}</option>)}</select></label><label><span>Debit</span><input type="number" min="0" step="0.01" value={line.debit} onChange={e=>update(line.id,{debit:e.target.value,credit:e.target.value&&Number(e.target.value)>0?"":line.credit})} placeholder="0.00"/></label><label><span>Credit</span><input type="number" min="0" step="0.01" value={line.credit} onChange={e=>update(line.id,{credit:e.target.value,debit:e.target.value&&Number(e.target.value)>0?"":line.debit})} placeholder="0.00"/></label><button type="button" className={styles.remove} disabled={lines.length<=2} onClick={()=>remove(line.id)} aria-label={`Remove line ${index+1}`}><Trash2 size={14}/></button></div>)}</div>
    <button className={styles.add} type="button" onClick={add}><Plus size={12}/>Add account</button>
    <div className={styles.totals}><div><span>Total debit</span><strong>{money(totals.debit,currency)}</strong></div><div><span>Total credit</span><strong>{money(totals.credit,currency)}</strong></div><span className={balanced?styles.balanced:styles.unbalanced}>{balanced?<CheckCircle2 size={12}/>:<AlertTriangle size={12}/>} {balanced?"Balanced":"Must balance"}</span></div>
    <input type="hidden" name="lines_json" value={JSON.stringify(payload)}/>
    {openingState.message?<div className={`${styles.message} ${openingState.status==="error"?styles.error:""}`}>{openingState.message}</div>:null}
    <div className={styles.footer}><button type="button" className={styles.secondary} onClick={()=>openingDialog.current?.close()}>Cancel</button><button type="submit" className={styles.primary} disabled={!balanced||payload.length<2||openingPending}>{openingPending?<LoaderCircle className={styles.spin} size={13}/>:<CheckCircle2 size={13}/>}Post opening position</button></div>
   </form>
  </dialog>

  <dialog ref={yearDialog} className={styles.dialog}>
   <form action={yearAction} className={`${styles.card} ${styles.smallCard}`}>
    <div className={styles.head}><div><p>Reset financial year</p><h3>Clear FY {year} and test again.</h3></div><button className={styles.close} type="button" onClick={()=>yearDialog.current?.close()} aria-label="Close"><X size={16}/></button></div>
    <p className={styles.lead}>This removes bookkeeping records dated in FY {year}: transactions, invoices, journal entries, bank rows and unsubmitted filing snapshots. Company settings and uploaded source documents are kept.</p>
    <div className={styles.warning}><strong>Destructive test action.</strong> A filed/accepted/submitted declaration or a locked year cannot be reset.</div>
    <label className={styles.confirm}><span>Type <b>RESET {year}</b> to confirm</span><input name="confirmation" autoComplete="off" placeholder={`RESET ${year}`} required/></label>
    {yearState.message?<div className={`${styles.message} ${yearState.status==="error"?styles.error:""}`}>{yearState.message}</div>:null}
    <div className={styles.footer}><button type="button" className={styles.secondary} onClick={()=>yearDialog.current?.close()}>Cancel</button><button type="submit" className={styles.danger} disabled={yearPending}>{yearPending?<LoaderCircle className={styles.spin} size={13}/>:<RotateCcw size={13}/>}Reset FY {year}</button></div>
   </form>
  </dialog>

  <dialog ref={allDialog} className={styles.dialog}>
   <form action={allAction} className={`${styles.card} ${styles.smallCard}`}>
    <div className={styles.head}><div><p>Clear bookkeeping</p><h3>Remove all test books.</h3></div><button className={styles.close} type="button" onClick={()=>allDialog.current?.close()} aria-label="Close"><X size={16}/></button></div>
    <p className={styles.lead}>This clears bookkeeping across all financial years: transactions, invoices, journals, bank imports and unsubmitted filing snapshots. Your company profile and uploaded document vault remain intact.</p>
    <div className={styles.warning}><strong>This is broader than “Reset FY {year}”.</strong> Use it only when you want to restart the entire bookkeeping test database for this company.</div>
    <label className={styles.confirm}><span>Type the exact legal company name to confirm: <b>{legalName}</b></span><input name="confirmation" autoComplete="off" required/></label>
    {allState.message?<div className={`${styles.message} ${allState.status==="error"?styles.error:""}`}>{allState.message}</div>:null}
    <div className={styles.footer}><button type="button" className={styles.secondary} onClick={()=>allDialog.current?.close()}>Cancel</button><button type="submit" className={styles.danger} disabled={allPending}>{allPending?<LoaderCircle className={styles.spin} size={13}/>:<Trash2 size={13}/>}Clear all bookkeeping</button></div>
   </form>
  </dialog>
 </>;
}
