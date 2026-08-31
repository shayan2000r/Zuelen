"use client";

import { Calculator, Camera, FileUp, LoaderCircle, PenLine, Plus, ReceiptText, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { createSourceTransaction, type TransactionActionState } from "@/app/app/transactions/actions";
import { FloatingActionPortal } from "@/components/floating-action-portal";
import { UpgradeWall } from "@/components/upgrade-wall";
import styles from "./live.module.css";
import choiceStyles from "./transaction-entry-choice.module.css";

const initialTransactionState: TransactionActionState = { status: "idle", message: "" };
const rates=[17,14,8,3,0];
function money(v:number){return new Intl.NumberFormat("en-LU",{style:"currency",currency:"EUR",minimumFractionDigits:2}).format(v||0)}

export function SourceTransactionForm({defaultDate,initialOpen=false,locale="en"}:{defaultDate?:string;initialOpen?:boolean;locale?:"en"|"fr"}){
 const fr=locale==="fr",[state,formAction,pending]=useActionState(createSourceTransaction,initialTransactionState),[open,setOpen]=useState(initialOpen),[entryMode,setEntryMode]=useState<"choose"|"manual">("choose"),[upgradeOpen,setUpgradeOpen]=useState(false),today=defaultDate||new Date().toISOString().slice(0,10);
 const[amount,setAmount]=useState(0),[rate,setRate]=useState(17),[included,setIncluded]=useState(true),[treatment,setTreatment]=useState("domestic");
 const calc=useMemo(()=>{if(!amount)return{net:0,vat:0,gross:0};if(treatment==="eu_b2b_reverse_charge"){const vat=amount*rate/100;return{net:amount,vat,gross:amount}}if(treatment==="non_eu"||treatment==="exempt_or_zero"||rate===0)return{net:amount,vat:0,gross:amount};if(included){const net=amount/(1+rate/100);return{net,vat:amount-net,gross:amount}}const vat=amount*rate/100;return{net:amount,vat,gross:amount+vat}},[amount,rate,included,treatment]);
 useEffect(()=>{if(state.status==="success")setOpen(false);if(state.status==="error"&&/premium/i.test(state.message))setUpgradeOpen(true)},[state]);
 useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!pending)setOpen(false)};window.addEventListener("keydown",onKey);return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",onKey)}},[open,pending]);
 function close(){setOpen(false);setEntryMode("choose")}
 return <>
  <FloatingActionPortal><button className={styles.fab} type="button" onClick={()=>{setEntryMode("choose");setOpen(true)}}><Plus size={17}/>{fr?"Ajouter":"Add"}</button></FloatingActionPortal>
  {open?<div className={styles.drawerOverlay} role="presentation" onMouseDown={e=>{if(e.currentTarget===e.target)close()}}><div className={styles.drawerShell}><button autoFocus className={styles.drawerClose} type="button" onClick={close} aria-label={fr?"Fermer":"Close"}><X size={18}/></button><aside className={`${styles.formPanel} ${styles.drawerCard}`} role="dialog" aria-modal="true" aria-labelledby="new-transaction-title">
   {entryMode==="choose"?<><p className={styles.eyebrow}>{fr?"Nouvelle activité":"New activity"}</p><h2 id="new-transaction-title">{fr?"Ajouter une transaction":"Add a transaction"}</h2><p>{fr?"Choisissez la méthode la plus rapide. Vous pourrez vérifier les détails avant la comptabilisation.":"Choose the fastest way to start. You can review the details before anything is posted."}</p><div className={choiceStyles.choices}>
    <Link href="/app/documents?create=upload"><span><FileUp size={20}/></span><div><strong>{fr?"Importer un document":"Upload document"}</strong><small>{fr?"Ajouter une facture, un reçu ou un justificatif.":"Add an invoice, receipt or supporting record."}</small></div></Link>
    <Link href="/app/documents?create=scan"><span><Camera size={20}/></span><div><strong>{fr?"Scanner":"Scan"}</strong><small>{fr?"Prendre une photo depuis un appareil compatible.":"Capture a document from a supported device."}</small></div></Link>
    <button type="button" onClick={()=>setEntryMode("manual")}><span><PenLine size={20}/></span><div><strong>{fr?"Saisie manuelle":"Manual"}</strong><small>{fr?"Saisir les informations vous-même.":"Enter the transaction details yourself."}</small></div></button>
   </div></>:<><button type="button" className={choiceStyles.back} onClick={()=>setEntryMode("choose")}>{fr?"← Retour":"← Back"}</button><p className={styles.eyebrow}>{fr?"Saisie manuelle":"Manual entry"}</p><h2 id="new-transaction-title">{fr?"Nouvelle transaction":"New transaction"}</h2><p>{fr?"Décrivez l’opération. Le traitement TVA détermine son enregistrement dans le grand livre.":"Tell Zuelen what happened. VAT treatment determines how the transaction is recorded in the ledger."}</p>
   <form action={formAction} className={styles.transactionForm}>
    <label className={styles.field}><span>{fr?"Type":"Type"}</span><select name="direction" defaultValue="expense" required><option value="expense">{fr?"Dépense":"Expense"}</option><option value="income">{fr?"Revenu / remboursement":"Income / refund"}</option></select></label>
    <label className={styles.field}><span>{fr?"Date":"Date"}</span><input name="occurred_on" type="date" defaultValue={today} required/></label>
    <label className={`${styles.field} ${styles.fieldFull}`}><span>{fr?"Traitement TVA":"VAT treatment"}</span><select name="vat_treatment" value={treatment} onChange={e=>setTreatment(e.target.value)}><option value="domestic">{fr?"TVA luxembourgeoise":"Luxembourg domestic VAT"}</option><option value="eu_b2b_reverse_charge">EU B2B · reverse charge</option><option value="non_eu">{fr?"Hors UE / importation":"Non-EU / import evidence"}</option><option value="exempt_or_zero">{fr?"Exonéré / taux zéro":"Exempt / zero-rated"}</option><option value="unknown">{fr?"À vérifier plus tard":"Not sure · review later"}</option></select></label>
    <label className={styles.field}><span>{fr?"Montant":"Amount"}</span><input name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required onChange={e=>setAmount(Number(e.target.value)||0)}/></label>
    <label className={styles.field}><span>{treatment==="eu_b2b_reverse_charge"?(fr?"Taux TVA notionnel":"Notional VAT rate"):(fr?"Taux TVA":"VAT rate")}</span><select name="vat_rate" value={rate} onChange={e=>setRate(Number(e.target.value))}>{rates.map(r=><option key={r} value={r}>{r}%</option>)}</select></label>
    {treatment==="domestic"?<label className={`${styles.field} ${styles.fieldFull}`}><span>{fr?"Le montant inclut-il la TVA ?":"Does the amount include VAT?"}</span><select name="vat_included" value={included?"yes":"no"} onChange={e=>setIncluded(e.target.value==="yes")}><option value="yes">{fr?"Oui · montant TTC":"Yes · amount is TTC / gross"}</option><option value="no">{fr?"Non · montant HT":"No · amount is HT / net"}</option></select></label>:<input type="hidden" name="vat_included" value="no"/>}
    <div className={`${styles.formMessage} ${styles.fieldFull}`}><Calculator size={14}/> Net {money(calc.net)} · TVA {money(calc.vat)} · Cash {money(calc.gross)}</div>
    <label className={styles.field}><span>{fr?"Client / fournisseur":"Customer / supplier"}</span><input name="counterparty_name" placeholder={fr?"Nom du tiers":"e.g. Adobe, Upwork, client name"}/></label>
    <label className={styles.field}><span>{fr?"Pays":"Country"}</span><input name="counterparty_country" maxLength={2} placeholder="LU / FR / US" style={{textTransform:"uppercase"}}/></label>
    <label className={`${styles.field} ${styles.fieldFull}`}><span>Description</span><textarea name="description" placeholder={fr?"Objet de la transaction":"What was this transaction for?"}/></label>
    {state.message?<div className={`${styles.formMessage} ${styles.fieldFull} ${state.status==="error"?styles.formError:""}`}>{state.message}</div>:null}
    <button className={styles.submitButton} type="submit" disabled={pending}>{pending?<LoaderCircle size={15}/>:state.status==="success"?<ReceiptText size={15}/>:<Plus size={15}/>}<span>{pending?(fr?"Enregistrement…":"Recording…"):(fr?"Enregistrer":"Record transaction")}</span></button>
   </form></>}
  </aside></div></div>:null}
  <UpgradeWall open={upgradeOpen} message={state.message} onClose={()=>setUpgradeOpen(false)}/>
 </>;
}
