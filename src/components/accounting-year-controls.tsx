"use client";

import { AlertTriangle, CalendarRange, CheckCircle2, FileUp, LoaderCircle, PenLine, Plus, RotateCcw, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { resetBookkeepingAction, resetFinancialYearAction, saveOpeningBalancesAction, type AccountingActionState } from "@/app/app/accounting/actions";
import { useI18n } from "@/components/locale-context";
import type { Locale } from "@/lib/i18n";
import styles from "./accounting-year-controls.module.css";
import choiceStyles from "./transaction-entry-choice.module.css";

type Account={id:string;code:string;label:string;account_type:string};
type OpeningLine={id:number;account_id:string;debit:string;credit:string};
const initial:AccountingActionState={status:"idle",message:""};
function money(value:number,currency:string,locale:Locale){return new Intl.NumberFormat(locale==="fr"?"fr-LU":"en-LU",{style:"currency",currency,minimumFractionDigits:2}).format(value||0)}

export function AccountingYearControls({year,currency,legalName,accounts,openingPosted,initialOpeningMode=null}:{year:number;currency:string;legalName:string;accounts:Account[];openingPosted:boolean;initialOpeningMode?:"upload"|"manual"|null}){
 const {locale}=useI18n();
 const fr=locale==="fr",l=(en:string,french:string)=>fr?french:en;
 const router=useRouter(),openingDialog=useRef<HTMLDialogElement>(null),yearDialog=useRef<HTMLDialogElement>(null),allDialog=useRef<HTMLDialogElement>(null);
 const[openingState,openingAction,openingPending]=useActionState(saveOpeningBalancesAction,initial),[yearState,yearAction,yearPending]=useActionState(resetFinancialYearAction,initial),[allState,allAction,allPending]=useActionState(resetBookkeepingAction,initial);
 const[lines,setLines]=useState<OpeningLine[]>([{id:1,account_id:"",debit:"",credit:""},{id:2,account_id:"",debit:"",credit:""}]);
 const[openingMode,setOpeningMode]=useState<"choose"|"manual">(initialOpeningMode==="manual"?"manual":"choose");
 const totals=useMemo(()=>lines.reduce((acc,line)=>({debit:acc.debit+(Number(line.debit)||0),credit:acc.credit+(Number(line.credit)||0)}),{debit:0,credit:0}),[lines]),balanced=totals.debit>0&&Math.abs(totals.debit-totals.credit)<.005;
 function update(id:number,patch:Partial<OpeningLine>){setLines(current=>current.map(line=>line.id===id?{...line,...patch}:line))}
 function add(){setLines(current=>[...current,{id:Date.now(),account_id:"",debit:"",credit:""}])}
 function remove(id:number){setLines(current=>current.length<=2?current:current.filter(line=>line.id!==id))}
 useEffect(()=>{if(openingState.status==="success"){openingDialog.current?.close();router.refresh()}},[openingState.status,router]);
 useEffect(()=>{if(yearState.status==="success"){yearDialog.current?.close();router.refresh()}},[yearState.status,router]);
 useEffect(()=>{if(allState.status==="success"){allDialog.current?.close();router.refresh()}},[allState.status,router]);
 useEffect(()=>{if(initialOpeningMode){setOpeningMode(initialOpeningMode==="manual"?"manual":"choose");openingDialog.current?.showModal()}},[initialOpeningMode]);
 const payload=lines.filter(line=>line.account_id&&(Number(line.debit)>0||Number(line.credit)>0)).map(line=>({account_id:line.account_id,debit:Number(line.debit)||0,credit:Number(line.credit)||0}));
 const accountType=(type:string)=>fr?({asset:"actif",liability:"passif",equity:"capitaux propres",revenue:"produit",expense:"charge"}[type]??type):type;
 return <>
  <section className={styles.panel}>
   <div className={styles.copy}><span className={styles.icon}><CalendarRange size={19}/></span><div><strong>{l(`Financial year ${year}`,`Exercice ${year}`)}</strong><span>{l("Set the opening position or restart bookkeeping for this year. Protected or filed periods remain locked.","Définissez la situation d’ouverture ou recommencez la comptabilité de cet exercice. Les périodes verrouillées ou déposées restent protégées.")}</span>{openingPosted?<span className={styles.posted}><CheckCircle2 size={11}/>{l("Opening position posted","Situation d’ouverture comptabilisée")}</span>:null}</div></div>
   <div className={styles.actions}><button type="button" className={styles.primary} disabled={openingPosted} onClick={()=>openingDialog.current?.showModal()}><Plus size={13}/>{openingPosted?l("Opening position added","Situation ajoutée"):l("Add opening position","Ajouter la situation d’ouverture")}</button><button type="button" className={styles.secondary} onClick={()=>yearDialog.current?.showModal()}><RotateCcw size={13}/>{l(`Reset ${year}`,`Réinitialiser ${year}`)}</button><button type="button" className={styles.danger} onClick={()=>allDialog.current?.showModal()}><Trash2 size={13}/>{l("Clear bookkeeping","Effacer la comptabilité")}</button></div>
  </section>

  <dialog ref={openingDialog} className={styles.dialog}>
   <form action={openingAction} className={styles.card}>
    <div className={styles.head}><div><p>{l("Opening position","Situation d’ouverture")} · {year}</p><h3>{l("How would you like to start?","Comment souhaitez-vous commencer ?")}</h3></div><button className={styles.close} type="button" onClick={()=>openingDialog.current?.close()} aria-label={l("Close","Fermer")}><X size={16}/></button></div>
    {openingMode==="choose"?<><p className={styles.lead}>{l("Bring forward your existing accounting data from a document, or enter the balances yourself.","Reprenez vos données comptables existantes depuis un document, ou saisissez vous-même les soldes.")}</p><div className={choiceStyles.choices}><Link href="/app/documents?create=upload&purpose=opening"><span><FileUp size={20}/></span><div><strong>{l("Upload document","Importer un document")}</strong><small>{l("Upload a prior PCN, P&L, annual accounts or filing document for extraction and review.","Importez un PCN, un compte de résultat, des comptes annuels ou un document de dépôt antérieur pour analyse et vérification.")}</small></div></Link><button type="button" onClick={()=>setOpeningMode("manual")}><span><PenLine size={20}/></span><div><strong>{l("Enter manually","Saisir manuellement")}</strong><small>{l("Enter the opening debit and credit balances by PCN account.","Saisissez les soldes d’ouverture débiteurs et créditeurs par compte PCN.")}</small></div></button></div></>:<><button type="button" className={choiceStyles.back} onClick={()=>setOpeningMode("choose")}>{l("← Back","← Retour")}</button><p className={styles.lead}>{l(`Enter the balance-sheet position carried forward into ${year}. Zuelen will only post it when total debits equal total credits.`,`Saisissez la situation du bilan reportée sur ${year}. Zuelen ne la comptabilisera que lorsque le total des débits sera égal au total des crédits.`)}</p>
    <div className={styles.openingList}>{lines.map((line,index)=><div className={styles.openingRow} key={line.id}><label><span>{l("Balance-sheet account","Compte de bilan")}</span><select value={line.account_id} onChange={e=>update(line.id,{account_id:e.target.value})} required><option value="">{l("Choose account…","Choisir un compte…")}</option>{accounts.map(account=><option value={account.id} key={account.id}>{account.code} · {account.label} · {accountType(account.account_type)}</option>)}</select></label><label><span>{l("Debit","Débit")}</span><input type="number" min="0" step="0.01" value={line.debit} onChange={e=>update(line.id,{debit:e.target.value,credit:e.target.value&&Number(e.target.value)>0?"":line.credit})} placeholder="0.00"/></label><label><span>{l("Credit","Crédit")}</span><input type="number" min="0" step="0.01" value={line.credit} onChange={e=>update(line.id,{credit:e.target.value,debit:e.target.value&&Number(e.target.value)>0?"":line.debit})} placeholder="0.00"/></label><button type="button" className={styles.remove} disabled={lines.length<=2} onClick={()=>remove(line.id)} aria-label={l(`Remove line ${index+1}`,`Supprimer la ligne ${index+1}`)}><Trash2 size={14}/></button></div>)}</div>
    <button className={styles.add} type="button" onClick={add}><Plus size={12}/>{l("Add account","Ajouter un compte")}</button>
    <div className={styles.totals}><div><span>{l("Total debit","Total débit")}</span><strong>{money(totals.debit,currency,locale)}</strong></div><div><span>{l("Total credit","Total crédit")}</span><strong>{money(totals.credit,currency,locale)}</strong></div><span className={balanced?styles.balanced:styles.unbalanced}>{balanced?<CheckCircle2 size={12}/>:<AlertTriangle size={12}/>} {balanced?l("Balanced","Équilibré"):l("Must balance","Doit être équilibré")}</span></div>
    <input type="hidden" name="lines_json" value={JSON.stringify(payload)}/>
    {openingState.message?<div className={`${styles.message} ${openingState.status==="error"?styles.error:""}`}>{openingState.message}</div>:null}
    <div className={styles.footer}><button type="button" className={styles.secondary} onClick={()=>openingDialog.current?.close()}>{l("Cancel","Annuler")}</button><button type="submit" className={styles.primary} disabled={!balanced||payload.length<2||openingPending}>{openingPending?<LoaderCircle className={styles.spin} size={13}/>:<CheckCircle2 size={13}/>} {l("Post opening position","Comptabiliser la situation")}</button></div></>}
   </form>
  </dialog>

  <dialog ref={yearDialog} className={styles.dialog}>
   <form action={yearAction} className={`${styles.card} ${styles.smallCard}`}>
    <div className={styles.head}><div><p>{l("Reset financial year","Réinitialiser l’exercice")}</p><h3>{l(`Clear ${year} bookkeeping and start again.`,`Effacer la comptabilité ${year} et recommencer.`)}</h3></div><button className={styles.close} type="button" onClick={()=>yearDialog.current?.close()} aria-label={l("Close","Fermer")}><X size={16}/></button></div>
    <p className={styles.lead}>{l(`This removes bookkeeping records dated in ${year}: transactions, invoices, journal entries, bank rows and unsubmitted filing snapshots. Company settings and uploaded source documents are kept.`,`Cette action supprime les écritures comptables datées de ${year} : transactions, factures, écritures de journal, mouvements bancaires et brouillons de dépôts non soumis. Les paramètres de la société et les documents importés sont conservés.`)}</p>
    <div className={styles.warning}><strong>{l("Destructive action.","Action destructive.")}</strong> {l("Filed, accepted or submitted declarations—and locked periods—cannot be reset.","Les déclarations déposées, acceptées ou soumises, ainsi que les périodes verrouillées, ne peuvent pas être réinitialisées.")}</div>
    <label className={styles.confirm}><span>{l("Type","Saisissez")} <b>RESET {year}</b> {l("to confirm","pour confirmer")}</span><input name="confirmation" autoComplete="off" placeholder={`RESET ${year}`} required/></label>
    {yearState.message?<div className={`${styles.message} ${yearState.status==="error"?styles.error:""}`}>{yearState.message}</div>:null}
    <div className={styles.footer}><button type="button" className={styles.secondary} onClick={()=>yearDialog.current?.close()}>{l("Cancel","Annuler")}</button><button type="submit" className={styles.danger} disabled={yearPending}>{yearPending?<LoaderCircle className={styles.spin} size={13}/>:<RotateCcw size={13}/>} {l(`Reset ${year}`,`Réinitialiser ${year}`)}</button></div>
   </form>
  </dialog>

  <dialog ref={allDialog} className={styles.dialog}>
   <form action={allAction} className={`${styles.card} ${styles.smallCard}`}>
    <div className={styles.head}><div><p>{l("Clear bookkeeping","Effacer la comptabilité")}</p><h3>{l("Clear bookkeeping across all financial years.","Effacer la comptabilité de tous les exercices.")}</h3></div><button className={styles.close} type="button" onClick={()=>allDialog.current?.close()} aria-label={l("Close","Fermer")}><X size={16}/></button></div>
    <p className={styles.lead}>{l("This clears transactions, invoices, journals, bank imports and unsubmitted filing snapshots across all resettable years. Your company profile and uploaded document vault remain intact.","Cette action efface les transactions, factures, journaux, imports bancaires et brouillons de dépôts non soumis de tous les exercices réinitialisables. Le profil de la société et les documents importés restent intacts.")}</p>
    <div className={styles.warning}><strong>{l(`This is broader than resetting ${year}.`,`Cette action va au-delà de la réinitialisation de ${year}.`)}</strong> {l("Use it only when you intentionally want to restart the company's bookkeeping.","Utilisez-la uniquement si vous souhaitez réellement recommencer toute la comptabilité de la société.")}</div>
    <label className={styles.confirm}><span>{l("Type the exact legal company name to confirm:","Saisissez la dénomination légale exacte pour confirmer :")} <b>{legalName}</b></span><input name="confirmation" autoComplete="off" required/></label>
    {allState.message?<div className={`${styles.message} ${allState.status==="error"?styles.error:""}`}>{allState.message}</div>:null}
    <div className={styles.footer}><button type="button" className={styles.secondary} onClick={()=>allDialog.current?.close()}>{l("Cancel","Annuler")}</button><button type="submit" className={styles.danger} disabled={allPending}>{allPending?<LoaderCircle className={styles.spin} size={13}/>:<Trash2 size={13}/>} {l("Clear bookkeeping","Effacer la comptabilité")}</button></div>
   </form>
  </dialog>
 </>;
}
