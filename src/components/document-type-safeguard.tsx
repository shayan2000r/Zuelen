"use client";

import { AlertTriangle, Check, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resolveDocumentTypeSafeguardAction } from "@/app/app/documents/actions";
import styles from "./document-type-safeguard.module.css";

export function DocumentTypeSafeguardActions({
  documentId,
  selectedType,
  detectedType,
  allowKeep,
}:{
  documentId:string;
  selectedType:string;
  detectedType:string;
  allowKeep:boolean;
}){
  const router=useRouter(),[pending,startTransition]=useTransition(),[message,setMessage]=useState<string|null>(null);
  function resolve(choice:"detected"|"selected"){
    startTransition(async()=>{
      const result=await resolveDocumentTypeSafeguardAction(documentId,choice);
      setMessage(result.message);
      if(result.status==="success")router.refresh();
    });
  }
  return <div className={styles.wrap}>
    <span className={styles.badge}><AlertTriangle size={11}/>Type review</span>
    <div className={styles.popover}>
      <strong>{selectedType.replaceAll("_"," ")} → {detectedType.replaceAll("_"," ")}</strong>
      <small>AI detected a different document type. Confirm it before using extracted facts for bookkeeping.</small>
      <div>
        <button type="button" onClick={()=>resolve("detected")} disabled={pending}>{pending?<LoaderCircle className={styles.spin} size={11}/>:<Check size={11}/>} Use detected</button>
        {allowKeep?<button type="button" onClick={()=>resolve("selected")} disabled={pending}>Keep selected</button>:null}
      </div>
      {message?<em>{message}</em>:null}
    </div>
  </div>;
}
