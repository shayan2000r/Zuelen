"use client";

import { Clock3, History, X } from "lucide-react";
import { useRef } from "react";
import styles from "./transaction-history-action.module.css";

type Event={id:number;event_type:string;actor_user_id:string|null;actor_name:string|null;metadata:Record<string,unknown>;created_at:string};

function eventCopy(event:Event){
  const type=event.event_type;
  if(type==="source_transaction.created")return["Created","Transaction added to Zuelen."];
  if(type==="source_transaction.posted")return["Posted","Accounting entry created and locked."];
  if(type==="source_transaction.updated")return["Details changed","Transaction details were updated safely."];
  if(type==="source_transaction.recategorized")return["Category changed","The old posting was reversed and replaced with the new category."];
  if(type==="source_transaction.exchange_rate_set")return["Exchange rate set","Foreign-currency conversion rate was recorded."];
  if(type==="source_transaction.status_changed")return["Status changed","Transaction workflow status changed."];
  if(type==="source_transaction.deleted")return["Removed / reversed","The transaction was removed from active books; posted accounting remains auditable."];
  return["Activity",type.replaceAll("_"," ").replaceAll("."," · ")];
}
function detail(event:Event){
  if(event.event_type==="source_transaction.exchange_rate_set"){
    const c=String(event.metadata.currency??""),r=String(event.metadata.exchange_rate_to_base??"");
    return c&&r?"1 "+c+" = "+r+" base currency":null;
  }
  if(event.event_type==="source_transaction.status_changed"||event.event_type==="source_transaction.posted"){
    const from=String(event.metadata.from??""),to=String(event.metadata.to??"");
    return from&&to?from+" → "+to:null;
  }
  return null;
}

export function TransactionHistoryAction({history=[]}:{history?:Event[]}){
  const dialog=useRef<HTMLDialogElement>(null);
  return <>
    <button type="button" className={styles.trigger} onClick={()=>dialog.current?.showModal()} aria-label="View audit history" title="Audit history"><History size={13}/>{history.length?<span>{history.length}</span>:null}</button>
    <dialog ref={dialog} className={styles.dialog} onClick={event=>{if(event.target===event.currentTarget)dialog.current?.close()}}>
      <section className={styles.card}>
        <header><div><small>Audit trail</small><h3>Transaction history</h3><p>Chronological record of important changes. Posted accounting is never silently overwritten.</p></div><button type="button" onClick={()=>dialog.current?.close()} aria-label="Close"><X size={16}/></button></header>
        {history.length?<div className={styles.timeline}>{history.map(event=>{const [title,copy]=eventCopy(event),extra=detail(event);return <article key={event.id}><span className={styles.dot}><Clock3 size={13}/></span><div><div className={styles.eventHead}><strong>{title}</strong><time>{new Date(event.created_at).toLocaleString("en-LU",{dateStyle:"medium",timeStyle:"short"})}</time></div><p>{copy}</p>{extra?<small>{extra}</small>:null}<em>{event.actor_name||"Zuelen system"}</em></div></article>})}</div>:<div className={styles.empty}>No audit events are recorded for this transaction yet. New activity will appear here automatically.</div>}
        <footer><button type="button" onClick={()=>dialog.current?.close()}>Close</button></footer>
      </section>
    </dialog>
  </>;
}
