"use client";

import { ArrowDownLeft, ArrowUpRight, CheckSquare2, LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { bulkDeleteTransactionsAction, type TransactionActionState } from "@/app/app/transactions/actions";
import { TransactionRowActions } from "@/components/transaction-row-actions";
import styles from "./transaction-table.module.css";

type Account={id:string;code:string;label:string;account_type:string};
type Row={id:string;occurred_on:string;direction:string;amount_gross:number|string;amount_net:number|string|null;vat_amount:number|string|null;vat_rate:number|string|null;vat_treatment:string|null;counterparty_country:string|null;currency:string;counterparty_name:string|null;description:string|null;classification_status:string;posted_journal_entry_id:string|null;suggested_account_id:string|null;suggestion_confidence:number|string|null;suggestion_kind:string|null;entry_number?:number|null;suggested_label?:string|null;suggested_code?:string|null};
const initial:TransactionActionState={status:"idle",message:""};
function money(value:number,currency:string){return new Intl.NumberFormat("en-LU",{style:"currency",currency,minimumFractionDigits:2}).format(value)}

export function TransactionTable({rows,accounts}:{rows:Row[];accounts:Account[]}){
 const router=useRouter(),[selected,setSelected]=useState<Set<string>>(new Set()),[state,action,pending]=useActionState(bulkDeleteTransactionsAction,initial);
 const allSelected=rows.length>0&&selected.size===rows.length;
 const ids=useMemo(()=>JSON.stringify([...selected]),[selected]);
 useEffect(()=>{if(state.status==="success"){setSelected(new Set());router.refresh()}},[state.status,router]);
 function toggle(id:string){setSelected(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next})}
 function toggleAll(){setSelected(allSelected?new Set():new Set(rows.map(row=>row.id)))}
 return <div className={styles.wrap}>
  {selected.size>0?<form action={action} className={styles.bulkBar} onSubmit={event=>{if(!window.confirm(`Delete ${selected.size} selected transaction${selected.size===1?"":"s"}? Posted entries will be reversed rather than erased.`))event.preventDefault()}}><input type="hidden" name="ids" value={ids}/><span><CheckSquare2 size={15}/><strong>{selected.size}</strong> selected</span><button type="submit" disabled={pending}>{pending?<LoaderCircle className={styles.spin} size={14}/>:<Trash2 size={14}/>}Delete selected</button>{state.status==="error"?<em>{state.message}</em>:null}</form>:null}
  <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th className={styles.selectCol}><label className={styles.checkWrap}><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all transactions"/><span/></label></th><th>Date</th><th>Transaction</th><th>Status</th><th>Amount</th><th aria-label="Actions"/></tr></thead><tbody>{rows.map(row=>{const income=row.direction==="income",suggested=row.suggested_code&&row.suggested_label;return <tr key={row.id} className={selected.has(row.id)?styles.selectedRow:""}><td className={styles.selectCol}><label className={styles.checkWrap}><input type="checkbox" checked={selected.has(row.id)} onChange={()=>toggle(row.id)} aria-label={`Select ${row.counterparty_name||row.description||"transaction"}`}/><span/></label></td><td className={styles.date}>{new Date(`${row.occurred_on}T12:00:00`).toLocaleDateString("en-LU",{day:"2-digit",month:"short"})}</td><td className={styles.name}><strong>{row.counterparty_name||row.description||(income?"Income":"Expense")}</strong><small>{row.description&&row.counterparty_name?row.description:row.classification_status!=="posted"&&suggested?`Suggested ${row.suggested_code} · ${row.suggested_label} · ${Math.round(Number(row.suggestion_confidence??0)*100)}%`:row.vat_treatment?row.vat_treatment.replaceAll("_"," "):"Recorded activity"}</small></td><td><span className={`${styles.status} ${row.classification_status==="posted"?styles.posted:""}`}>{row.classification_status==="posted"?`Posted${row.entry_number?` · J${String(row.entry_number).padStart(4,"0")}`:""}`:suggested?"Suggested":"Review"}</span></td><td className={`${styles.amount} ${income?styles.income:""}`}>{income?<ArrowDownLeft size={12}/>:<ArrowUpRight size={12}/>}<strong>{income?"+":"−"}{money(Number(row.amount_gross),row.currency)}</strong></td><td className={styles.actions}><TransactionRowActions row={row} accounts={accounts}/></td></tr>})}</tbody></table></div>
 </div>;
}
