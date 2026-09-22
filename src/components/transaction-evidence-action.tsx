"use client";

import { CheckCircle2, FileText, LoaderCircle, Paperclip, X } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { attachEvidenceToTransactionAction, type TransactionActionState } from "@/app/app/transactions/actions";
import styles from "./transaction-evidence-action.module.css";

const initial:TransactionActionState={status:"idle",message:""};

export function TransactionEvidenceAction({
  transactionId,
  title,
  evidenceCount=0,
}:{
  transactionId:string;
  title:string;
  evidenceCount?:number;
}){
  const router=useRouter(),dialog=useRef<HTMLDialogElement>(null);
  const[state,action,pending]=useActionState(attachEvidenceToTransactionAction,initial);

  useEffect(()=>{
    if(state.status!=="success")return;
    router.refresh();
    const timer=window.setTimeout(()=>dialog.current?.close(),650);
    return()=>window.clearTimeout(timer);
  },[state.status,router]);

  return <>
    <button
      type="button"
      className={styles.trigger}
      onClick={()=>dialog.current?.showModal()}
      aria-label={evidenceCount?"Attach evidence · "+evidenceCount+" linked":"Attach evidence"}
      title={evidenceCount?evidenceCount+" linked document"+(evidenceCount===1?"":"s")+" · attach more evidence":"Attach evidence"}
    >
      <Paperclip size={13}/>
      {evidenceCount>0?<span>{evidenceCount}</span>:null}
    </button>
    <dialog ref={dialog} className={styles.dialog} onClick={event=>{if(event.currentTarget===event.target&&!pending)dialog.current?.close()}}>
      <div className={styles.card}>
        <header>
          <div><small>Source evidence</small><h3>Attach to transaction</h3><p>{title}</p></div>
          <button type="button" onClick={()=>dialog.current?.close()} disabled={pending} aria-label="Close"><X size={16}/></button>
        </header>
        <form action={action}>
          <input type="hidden" name="source_transaction_id" value={transactionId}/>
          <label>
            <span>Document type</span>
            <select name="document_type" defaultValue="receipt" disabled={pending}>
              <option value="receipt">Receipt</option>
              <option value="purchase_invoice">Supplier invoice</option>
              <option value="sales_invoice">Sales invoice</option>
              <option value="other">Other supporting document</option>
            </select>
          </label>
          <label className={styles.fileField}>
            <span>Evidence file</span>
            <div><FileText size={18}/><strong>Choose PDF or image</strong><small>PDF, JPG, PNG or WebP · max 25 MB</small></div>
            <input name="evidence_file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" required disabled={pending}/>
          </label>
          <p className={styles.note}>The document will be stored in Documents and linked directly to this transaction. Attaching evidence does not rewrite posted accounting.</p>
          {state.message?<div className={state.status==="error"?styles.error:styles.success}>{state.status==="success"?<CheckCircle2 size={14}/>:null}{state.message}</div>:null}
          <footer>
            <button type="button" className={styles.secondary} onClick={()=>dialog.current?.close()} disabled={pending}>Cancel</button>
            <button type="submit" className={styles.primary} disabled={pending}>{pending?<LoaderCircle className={styles.spin} size={14}/>:<Paperclip size={14}/>} {pending?"Attaching…":"Attach evidence"}</button>
          </footer>
        </form>
      </div>
    </dialog>
  </>;
}
