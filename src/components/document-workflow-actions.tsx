"use client";

import { Check, Link2, LoaderCircle, ReceiptText, RefreshCw } from "lucide-react";
import { useActionState } from "react";
import { applyDocumentMatchAction, confirmDocumentMatchAction, createTaxEventAction, refreshDocumentMatchesAction, type DocumentExtractionState } from "@/app/app/documents/actions";

const initial:DocumentExtractionState={status:"idle",message:""};
const buttonStyle={height:28,border:"1px solid #dce5dc",borderRadius:8,background:"#fff",padding:"0 9px",fontSize:11,fontWeight:650,display:"inline-flex",alignItems:"center",gap:5,cursor:"pointer"} as const;

export function DocumentMatchActions({documentId,linkId,score,posted}:{documentId:string;linkId?:string|null;score?:number|null;posted?:boolean}){
 const[refreshState,refreshAction,refreshing]=useActionState(refreshDocumentMatchesAction,initial);
 const[confirmState,confirmAction,confirming]=useActionState(confirmDocumentMatchAction,initial);
 const[applyState,applyAction,applying]=useActionState(applyDocumentMatchAction,initial);
 const message=applyState.message||confirmState.message||refreshState.message;
 return <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
  {linkId?<><span style={{fontSize:11,color:"#647267"}}>{score!=null?`${Math.round(score*100)}% match`:"Likely match"}</span>{posted?<form action={confirmAction}><input type="hidden" name="link_id" value={linkId}/><button style={buttonStyle} disabled={confirming}>{confirming?<LoaderCircle size={12}/>:<Link2 size={12}/>}Link evidence</button></form>:<form action={applyAction}><input type="hidden" name="link_id" value={linkId}/><button style={{...buttonStyle,background:"#1a7431",color:"#fff",borderColor:"#1a7431"}} disabled={applying}>{applying?<LoaderCircle size={12}/>:<Check size={12}/>}Apply & link</button></form>}</>:<form action={refreshAction}><input type="hidden" name="document_id" value={documentId}/><button style={buttonStyle} disabled={refreshing}>{refreshing?<LoaderCircle size={12}/>:<RefreshCw size={12}/>}Find transaction</button></form>}
  {message?<span style={{fontSize:10,color:applyState.status==="error"||confirmState.status==="error"||refreshState.status==="error"?"#a65340":"#24713a"}}>{message}</span>:null}
 </div>;
}

export function TaxNoticeAction({documentId,exists}:{documentId:string;exists:boolean}){
 const[state,action,pending]=useActionState(createTaxEventAction,initial);
 if(exists)return <span style={{fontSize:11,color:"#24713a",display:"inline-flex",gap:5,alignItems:"center"}}><Check size={12}/>Tax case created</span>;
 return <form action={action} style={{display:"flex",alignItems:"center",gap:6}}><input type="hidden" name="document_id" value={documentId}/><button style={{...buttonStyle,background:"#10451d",color:"#fff",borderColor:"#10451d"}} disabled={pending}>{pending?<LoaderCircle size={12}/>:<ReceiptText size={12}/>}Create tax case</button>{state.message?<span style={{fontSize:10,color:state.status==="error"?"#a65340":"#24713a"}}>{state.message}</span>:null}</form>;
}
