"use client";

import { CheckCircle2, ExternalLink, FileCheck2, FileText, LoaderCircle, Paperclip, UploadCloud, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { attachEvidenceToTransactionAction, type TransactionActionState } from "@/app/app/transactions/actions";
import styles from "./transaction-evidence-action.module.css";

const initial:TransactionActionState={status:"idle",message:""};
type Evidence={id:string;file_name:string;type:string;file_size:number|null;created_at:string};

function fileSize(bytes:number|null){
  if(!bytes)return "—";
  return bytes>=1024*1024?(bytes/1024/1024).toFixed(2)+" MB":Math.max(1,Math.round(bytes/1024))+" KB";
}
function typeLabel(type:string){
  return ({receipt:"Receipt",purchase_invoice:"Supplier invoice",sales_invoice:"Sales invoice",other:"Supporting document"} as Record<string,string>)[type]??"Supporting document";
}
function dateLabel(value:string){
  return new Date(value.length===10?value+"T12:00:00":value).toLocaleDateString("en-LU",{day:"2-digit",month:"short",year:"numeric"});
}
function money(value:number,currency:string){
  return new Intl.NumberFormat("en-LU",{style:"currency",currency,minimumFractionDigits:2}).format(value);
}

export function TransactionEvidenceAction({
  transactionId,
  title,
  occurredOn,
  amountGross,
  currency,
  evidence=[],
}:{
  transactionId:string;
  title:string;
  occurredOn:string;
  amountGross:number;
  currency:string;
  evidence?:Evidence[];
}){
  const router=useRouter(),dialog=useRef<HTMLDialogElement>(null),formRef=useRef<HTMLFormElement>(null),fileRef=useRef<HTMLInputElement>(null);
  const[state,action,pending]=useActionState(attachEvidenceToTransactionAction,initial);
  const[selectedFile,setSelectedFile]=useState<File|null>(null);

  useEffect(()=>{
    if(state.status!=="success")return;
    setSelectedFile(null);
    formRef.current?.reset();
    router.refresh();
  },[state.status,router]);

  const count=evidence.length;
  return <>
    <button
      type="button"
      className={styles.trigger}
      onClick={()=>dialog.current?.showModal()}
      aria-label={count?"Evidence · "+count+" linked":"Attach evidence"}
      title={count?count+" linked document"+(count===1?"":"s"):"Attach evidence"}
    >
      <Paperclip size={14}/>
      {count>0?<span className={styles.triggerCount}>{count}</span>:null}
    </button>

    <dialog ref={dialog} className={styles.dialog} onClick={event=>{if(event.currentTarget===event.target&&!pending)dialog.current?.close()}}>
      <div className={styles.card}>
        <header className={styles.header}>
          <div>
            <small>Transaction evidence</small>
            <h3>Evidence</h3>
            <p>View the documents already linked to this transaction or add another one.</p>
          </div>
          <button type="button" className={styles.closeButton} onClick={()=>dialog.current?.close()} disabled={pending} aria-label="Close evidence panel"><X size={17}/></button>
        </header>

        <section className={styles.transactionContext}>
          <span className={styles.contextIcon}><Paperclip size={16}/></span>
          <div>
            <small>Linked transaction</small>
            <strong>{title}</strong>
            <span>{dateLabel(occurredOn)} · {money(amountGross,currency)}</span>
          </div>
          <span className={styles.linkedPill}><CheckCircle2 size={13}/>Linked</span>
        </section>

        <section className={styles.evidenceSection}>
          <div className={styles.sectionHead}>
            <div><span>Attached evidence</span><strong>{count} {count===1?"document":"documents"}</strong></div>
          </div>
          {count?
            <div className={styles.evidenceList}>
              {evidence.map(item=><article className={styles.evidenceItem} key={item.id}>
                <span className={styles.fileIcon}><FileCheck2 size={16}/></span>
                <div className={styles.fileCopy}>
                  <strong>{item.file_name}</strong>
                  <span>{typeLabel(item.type)} · {fileSize(item.file_size)} · {dateLabel(item.created_at)}</span>
                </div>
                <Link href={"/app/documents/"+item.id+"/open"} target="_blank" className={styles.viewButton}>
                  View <ExternalLink size={12}/>
                </Link>
              </article>)}
            </div>
          :<div className={styles.emptyEvidence}><FileText size={18}/><div><strong>No evidence attached yet</strong><span>Add a receipt, supplier invoice or another supporting document below.</span></div></div>}
        </section>

        <form ref={formRef} action={action} className={styles.form}>
          <input type="hidden" name="source_transaction_id" value={transactionId}/>
          <div className={styles.addHead}><div><span>Add evidence</span><strong>{count?"Attach another document":"Attach the source document"}</strong></div></div>

          <label className={styles.typeField}>
            <span>Document type</span>
            <select name="document_type" defaultValue="receipt" disabled={pending}>
              <option value="receipt">Receipt</option>
              <option value="purchase_invoice">Supplier invoice</option>
              <option value="sales_invoice">Sales invoice</option>
              <option value="other">Other supporting document</option>
            </select>
          </label>

          <div className={styles.uploadField}>
            <span>File</span>
            <input
              ref={fileRef}
              className={styles.fileInput}
              name="evidence_file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              required
              disabled={pending}
              onChange={event=>setSelectedFile(event.target.files?.[0]??null)}
            />
            {selectedFile?
              <div className={styles.selectedFile}>
                <span className={styles.selectedFileIcon}><FileText size={17}/></span>
                <div><strong>{selectedFile.name}</strong><span>{fileSize(selectedFile.size)}</span></div>
                <button type="button" onClick={()=>{if(fileRef.current)fileRef.current.value="";setSelectedFile(null)}} disabled={pending} aria-label="Remove selected file"><X size={14}/></button>
              </div>
            :<button type="button" className={styles.dropzone} onClick={()=>fileRef.current?.click()} disabled={pending}>
                <span><UploadCloud size={20}/></span>
                <div><strong>Choose PDF or image</strong><small>PDF, JPG, PNG or WebP · max 25 MB</small></div>
              </button>}
          </div>

          <p className={styles.note}>Saved in Documents and linked to this transaction. Adding evidence never changes the accounting entry itself.</p>
          {state.message?<div className={state.status==="error"?styles.error:styles.success}>{state.status==="success"?<CheckCircle2 size={14}/>:null}{state.message}</div>:null}

          <footer className={styles.footer}>
            <button type="button" className={styles.secondary} onClick={()=>dialog.current?.close()} disabled={pending}>Close</button>
            <button type="submit" className={styles.primary} disabled={pending||!selectedFile}>
              {pending?<LoaderCircle className={styles.spin} size={14}/>:<Paperclip size={14}/>}
              {pending?"Attaching…":"Attach evidence"}
            </button>
          </footer>
        </form>
      </div>
    </dialog>
  </>;
}
