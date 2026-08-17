"use client";
import { CheckCircle2, FileCheck2, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { prepareVatFilingAction, type VatFilingState } from "@/app/app/vat/actions";
const initial:VatFilingState={status:"idle",message:""};
export function VatFilingAction({start,end,ready}:{start:string;end:string;ready:boolean}){const[state,action,pending]=useActionState(prepareVatFilingAction,initial);return <form action={action} style={{display:"grid",gap:8,marginTop:14}}><input type="hidden" name="period_start" value={start}/><input type="hidden" name="period_end" value={end}/><button type="submit" disabled={!ready||pending} style={{height:38,border:0,borderRadius:10,background:ready?"#1a7431":"#dfe7df",color:ready?"#fff":"#7b847b",fontWeight:700,cursor:ready?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>{pending?<LoaderCircle size={14}/>:state.status==="success"?<CheckCircle2 size={14}/>:<FileCheck2 size={14}/>} {pending?"Preparing…":"Prepare filing snapshot"}</button>{state.message?<span style={{fontSize:11,color:state.status==="error"?"#a65340":"#24713a"}}>{state.message}</span>:null}</form>}
