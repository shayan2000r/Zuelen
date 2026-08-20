"use client";

import { ArrowDownLeft, ArrowUpRight, CheckSquare2, LoaderCircle, Trash2 } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { bulkRemoveBankMovements, type BankRemovalState } from "@/app/app/banking/remove-actions";
import styles from "./banking.module.css";
import ui from "./banking-upgrades.module.css";

type Row={id:string;bank_account_id:string;booking_date:string;amount:number|string;currency:string;counterparty_name:string|null;reference:string|null;match_status:string};
type Account={id:string;name:string};
const initial:BankRemovalState={status:"idle",message:""};
function money(value:number,currency:string){return new Intl.NumberFormat("en-LU",{style:"currency",currency,minimumFractionDigits:2}).format(value)}

export function BankMovementTable({rows,accounts,readOnly=false}:{rows:Row[];accounts:Account[];readOnly?:boolean}){
 const[state,action,pending]=useActionState(bulkRemoveBankMovements,initial),[selected,setSelected]=useState<Set<string>>(new Set()),accountMap=useMemo(()=>new Map(accounts.map(a=>[a.id,a])),[accounts]),all=!readOnly&&rows.length>0&&selected.size===rows.length;
 function toggle(id:string){if(readOnly)return;setSelected(prev=>{const n=new Set(prev);if(n.has(id))n.delete(id);else n.add(id);return n})}
 function toggleAll(){if(readOnly)return;setSelected(all?new Set():new Set(rows.map(r=>r.id)))}
 return <>
  {!readOnly&&selected.size>0?<div className={ui.bulkBar}><div><CheckSquare2 size={15}/><strong>{selected.size} selected</strong><span>Removing posted movements creates reversals; history stays auditable.</span></div><form action={action} onSubmit={e=>{if(!window.confirm(`Remove ${selected.size} selected bank movement${selected.size===1?"":"s"} from active books?`))e.preventDefault()}}><input type="hidden" name="ids" value={JSON.stringify([...selected])}/><button type="submit" disabled={pending}>{pending?<LoaderCircle className={styles.spin} size={14}/>:<Trash2 size={14}/>}Remove selected</button></form></div>:null}
  {!readOnly&&state.message?<div className={`${ui.actionMessage} ${state.status==="error"?ui.actionError:""}`}>{state.message}</div>:null}
  <div className={`${styles.tableWrap} bankingSelectableTable`}><table><colgroup>{!readOnly?<col className={styles.selectCol}/>:null}<col className={styles.dateCol}/><col className={styles.movementCol}/><col className={styles.accountCol}/><col className={styles.statusCol}/><col className={styles.amountCol}/></colgroup><thead><tr>{!readOnly?<th className={ui.selectCell}><label className={ui.selectControl}><input type="checkbox" checked={all} onChange={toggleAll} aria-label="Select all visible bank movements"/><span/></label></th>:null}<th>Date</th><th>Movement</th><th>Account</th><th>Status</th><th>Amount</th></tr></thead><tbody>{rows.map(row=>{const positive=Number(row.amount)>=0,account=accountMap.get(row.bank_account_id),checked=!readOnly&&selected.has(row.id);return <tr key={row.id} className={`${positive?ui.inflowRow:ui.outflowRow} ${checked?ui.selectedRow:""}`}>{!readOnly?<td className={ui.selectCell}><label className={ui.selectControl}><input type="checkbox" checked={checked} onChange={()=>toggle(row.id)} aria-label={`Select ${row.counterparty_name||row.reference||"bank movement"}`}/><span/></label></td>:null}<td>{new Date(`${row.booking_date}T12:00:00`).toLocaleDateString("en-LU",{day:"2-digit",month:"short"})}</td><td><strong>{row.counterparty_name||row.reference||"Bank movement"}</strong><small>{row.reference&&row.counterparty_name?row.reference:"Statement import"}</small></td><td><span>{account?.name||"Bank"}</span></td><td><em className={row.match_status==="matched"?styles.matched:styles.open}>{row.match_status==="matched"?"Reconciled":"Needs review"}</em></td><td><span className={`${ui.amountPill} ${positive?styles.moneyIn:styles.moneyOut}`}>{positive?<ArrowUpRight size={12}/>:<ArrowDownLeft size={12}/>} {positive?"+":"−"}{money(Math.abs(Number(row.amount)),row.currency)}</span></td></tr>})}</tbody></table></div>
 </>;
}
