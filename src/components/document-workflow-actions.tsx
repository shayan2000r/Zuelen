"use client";

import { Check, Link2, LoaderCircle, ReceiptText, RefreshCw } from "lucide-react";
import { useActionState } from "react";
import { applyDocumentMatchAction, confirmDocumentMatchAction, createTaxEventAction, refreshDocumentMatchesAction, type DocumentExtractionState } from "@/app/app/documents/actions";
import styles from "./documents.module.css";

const initial:DocumentExtractionState={status:"idle",message:""};
export function DocumentMatchActions({documentId,linkId,score,status,posted}:{documentId:string;linkId?:string|null;score?:number|null;status?:string|null;posted?:boolean}){
 const[refreshState,refreshAction,refreshing]=useActionState(refreshDocumentMatchesAction,initial),[confirmState,confirmAction,confirming]=useActionState(confirmDocumentMatchAction,initial),[applyState,applyAction,applying]=useActionState(applyDocumentMatchAction,initial),message=applyState.message||confirmState.message||refreshState.message;
 const linked=status==="confirmed"||applyState.status==="success"||confirmState.status==="success";
 return <div className={styles.workflowActions}>{linkId?<><span className={styles.matchScore}>{score!=null?`${Math.round(score*100)}% match`:"Likely match"}</span>{linked?<span className={styles.workflowSuccess}><Check size={12}/>Linked</span>:posted?<form action={confirmAction}><input type="hidden" name="link_id" value={linkId}/><button className={styles.secondaryAction} disabled={confirming}>{confirming?<LoaderCircle size={12}/>:<Link2 size={12}/>}Link evidence</button></form>:<form action={applyAction}><input type="hidden" name="link_id" value={linkId}/><button className={styles.primaryAction} disabled={applying}>{applying?<LoaderCircle size={12}/>:<Check size={12}/>}Apply & link</button></form>}</>:<form action={refreshAction}><input type="hidden" name="document_id" value={documentId}/><button className={styles.secondaryAction} disabled={refreshing}>{refreshing?<LoaderCircle size={12}/>:<RefreshCw size={12}/>}Find transaction</button></form>}{message&&!(linked&&message.toLowerCase().includes("linked"))?<span className={applyState.status==="error"||confirmState.status==="error"||refreshState.status==="error"?styles.workflowError:styles.workflowSuccess}>{message}</span>:null}</div>;
}

export function TaxNoticeAction({documentId,exists}:{documentId:string;exists:boolean}){
 const[state,action,pending]=useActionState(createTaxEventAction,initial);if(exists)return <span className={styles.workflowSuccess}><Check size={12}/>Tax case created</span>;
 return <form action={action} className={styles.workflowActions}><input type="hidden" name="document_id" value={documentId}/><button className={styles.primaryAction} disabled={pending}>{pending?<LoaderCircle size={12}/>:<ReceiptText size={12}/>}Create tax case</button>{state.message?<span className={state.status==="error"?styles.workflowError:styles.workflowSuccess}>{state.message}</span>:null}</form>;
}
