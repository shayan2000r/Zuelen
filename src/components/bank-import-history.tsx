"use client";

import { AlertTriangle, LoaderCircle, Trash2 } from "lucide-react";
import { useActionState } from "react";
import { deleteInactiveImportBatch, removeImportBatch, type BankRemovalState } from "@/app/app/banking/remove-actions";
import styles from "./banking.module.css";
import ui from "./banking-upgrades.module.css";

type Batch={id:string;file_name:string|null;imported_count:number;duplicate_count:number;created_at:string;isPotentialDuplicate?:boolean;activeCount?:number};
const initial:BankRemovalState={status:"idle",message:""};

function BatchRow({batch}:{batch:Batch}){
 const[removeState,removeAction,removePending]=useActionState(removeImportBatch,initial);
 const[deleteState,deleteAction,deletePending]=useActionState(deleteInactiveImportBatch,initial);
 const state=deleteState.status!=="idle"?deleteState:removeState,pending=removePending||deletePending,isInactive=batch.activeCount===0;
 return <div className={`${ui.batchItem} ${batch.isPotentialDuplicate?ui.duplicateBatch:""}`}>
  <div className={ui.batchTop}><strong title={batch.file_name||"Bank statement"}>{batch.file_name||"Bank statement"}</strong>{batch.isPotentialDuplicate?<em><AlertTriangle size={12}/>Possible duplicate</em>:null}</div>
  <span>{batch.imported_count} imported · {batch.duplicate_count} skipped{isInactive?" · inactive":""}</span>
  <div className={ui.batchFoot}><small>{new Date(batch.created_at).toLocaleString("en-LU",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</small>
   {!isInactive?<form action={removeAction} onSubmit={e=>{if(!window.confirm(`Remove the active movements imported from ${batch.file_name||"this statement"}? The batch history remains available.`))e.preventDefault()}}><input type="hidden" name="batch_id" value={batch.id}/><button type="submit" disabled={pending} title="Remove this imported batch from active books">{removePending?<LoaderCircle className={styles.spin} size={13}/>:<Trash2 size={13}/>}</button></form>:<form action={deleteAction} onSubmit={e=>{if(!window.confirm(`Remove ${batch.file_name||"this inactive import"} from import history? The ignored accounting audit trail stays preserved.`))e.preventDefault()}}><input type="hidden" name="batch_id" value={batch.id}/><button type="submit" disabled={pending} title="Remove inactive import from history">{deletePending?<LoaderCircle className={styles.spin} size={13}/>:<Trash2 size={13}/>}</button></form>}
  </div>{state.message?<small className={state.status==="error"?ui.batchError:ui.batchSuccess}>{state.message}</small>:null}
 </div>
}

export function BankImportHistory({batches}:{batches:Batch[]}){return <article className={styles.importHistory}><div><p>Import history</p><h2>Recent uploaded batches</h2></div>{batches.length===0?<span>No imports yet</span>:<div className={styles.batchList}>{batches.map(batch=><BatchRow batch={batch} key={batch.id}/>)}</div>}</article>}
