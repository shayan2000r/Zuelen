"use client";

import { LoaderCircle, Pencil, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { issueDraftInvoiceAction, voidInvoiceAction, type InvoiceActionState } from "@/app/app/invoices/actions";
import { useI18n } from "@/components/locale-context";
import { useRolePermissions } from "@/components/role-context";
import styles from "./record-actions.module.css";

const initial:InvoiceActionState={status:"idle",message:"",invoiceId:null};
export function InvoiceRecordActions({invoiceId,paymentStatus,status}:{invoiceId:string;paymentStatus:string;status:string}){
  const{canBookkeep}=useRolePermissions(),{locale}=useI18n(),fr=locale==="fr",router=useRouter();const[deleteState,deleteAction,deletePending]=useActionState(voidInvoiceAction,initial);const[issueState,issueAction,issuePending]=useActionState(issueDraftInvoiceAction,initial);
  useEffect(()=>{if(deleteState.status==="success")router.push("/app/invoices")},[router,deleteState.status]);useEffect(()=>{if(issueState.status==="success")router.refresh()},[router,issueState.status]);
  if(!canBookkeep)return null;const draft=status==="draft";
  return <div className={styles.invoiceActions}><Link href={draft?`/app/invoices/${invoiceId}/edit`:`/app/invoices/${invoiceId}/correct`} className={styles.editLink}><Pencil size={13}/>{fr?"Modifier":"Edit"}</Link>{draft?<form action={issueAction}><input type="hidden" name="invoice_id" value={invoiceId}/><button type="submit" className={styles.editLink} disabled={issuePending}>{issuePending?<LoaderCircle className={styles.spin} size={13}/>:<Send size={13}/>} {fr?"Émettre et comptabiliser":"Issue & post"}</button></form>:null}<form action={deleteAction} onSubmit={event=>{const allowed=draft||paymentStatus==="unpaid";const message=draft?(fr?"Supprimer cette facture brouillon ? Rien n’a encore été comptabilisé.":"Delete this draft invoice? Nothing has been posted yet."):paymentStatus==="unpaid"?(fr?"Supprimer cette facture émise ? Zuelen contrepassera sa comptabilisation et la retirera des créances actives.":"Delete this issued invoice? Zuelen will reverse its posted accounting and remove it from active receivables."):(fr?"Cette facture comporte des paiements. Elle ne peut pas être supprimée avant l’utilisation d’un workflow de note de crédit.":"This invoice has payments. It cannot be deleted until a credit-note workflow is used.");if(!window.confirm(message)||!allowed)event.preventDefault()}}><input type="hidden" name="invoice_id" value={invoiceId}/><button type="submit" className={styles.deleteLink} disabled={deletePending||(!draft&&paymentStatus!=="unpaid")}>{deletePending?<LoaderCircle className={styles.spin} size={13}/>:<Trash2 size={13}/>} {fr?"Supprimer":"Delete"}</button></form>{deleteState.status==="error"?<span className={styles.invoiceError}>{deleteState.message}</span>:null}{issueState.status==="error"?<span className={styles.invoiceError}>{issueState.message}</span>:null}</div>
}
