"use client";

import { LoaderCircle, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { voidInvoiceAction, type InvoiceActionState } from "@/app/app/invoices/actions";
import styles from "./record-actions.module.css";

const initial:InvoiceActionState={status:"idle",message:"",invoiceId:null};
export function InvoiceRecordActions({invoiceId,paymentStatus}:{invoiceId:string;paymentStatus:string}){
  const router=useRouter();const[state,action,pending]=useActionState(voidInvoiceAction,initial);
  useEffect(()=>{if(state.status==="success")router.push("/app/invoices")},[router,state.status]);
  return <div className={styles.invoiceActions}><Link href={`/app/invoices/${invoiceId}/correct`} className={styles.editLink}><Pencil size={13}/>Edit</Link><form action={action} onSubmit={event=>{const message=paymentStatus==="unpaid"?"Delete this issued invoice? Compta will reverse its posted accounting and remove it from active receivables.":"This invoice has payments. It cannot be deleted until a credit-note workflow is used.";if(!window.confirm(message)||paymentStatus!=="unpaid")event.preventDefault()}}><input type="hidden" name="invoice_id" value={invoiceId}/><button type="submit" className={styles.deleteLink} disabled={pending||paymentStatus!=="unpaid"}>{pending?<LoaderCircle className={styles.spin} size={13}/>:<Trash2 size={13}/>}Delete</button></form>{state.status==="error"?<span className={styles.invoiceError}>{state.message}</span>:null}</div>
}
