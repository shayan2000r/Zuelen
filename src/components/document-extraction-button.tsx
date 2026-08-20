"use client";

import { LoaderCircle, Sparkles } from "lucide-react";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { extractDocumentAction, type DocumentExtractionState } from "@/app/app/documents/actions";
import { useRolePermissions } from "@/components/role-context";
import styles from "./documents.module.css";

const initial:DocumentExtractionState={status:"idle",message:""};

export function DocumentExtractionButton({documentId,status}:{documentId:string;status:string}){
  const{canBookkeep}=useRolePermissions(),router=useRouter();
  const[state,action,pending]=useActionState(extractDocumentAction,initial);
  useEffect(()=>{if(state.status==="success")router.refresh()},[router,state.status]);
  if(!canBookkeep)return null;
  const label=status==="needs_review"||status==="complete"?"Re-analyze":status==="failed"?"Retry AI":"Analyze";
  return <div className={styles.aiActionWrap}><form action={action}><input type="hidden" name="document_id" value={documentId}/><button className={styles.aiButton} type="submit" disabled={pending}>{pending?<LoaderCircle className={styles.spin} size={13}/>:<Sparkles size={13}/>}<span>{pending?"Analyzing…":label}</span></button></form>{state.status==="error"?<span className={styles.aiError}>{state.message}</span>:null}</div>;
}
