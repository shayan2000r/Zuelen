"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export type BankRemovalState={status:"idle"|"success"|"error";message:string};
function validUuid(value:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)}
function refresh(){for(const p of ["/app","/app/banking","/app/transactions","/app/accounting","/app/vat","/app/taxes","/app/reports","/app/year-end"])revalidatePath(p)}

export async function bulkRemoveBankMovements(_previous:BankRemovalState,formData:FormData):Promise<BankRemovalState>{
 const w=await getWorkspace();if(!w.authenticated||!w.company)return{status:"error",message:"Your session expired. Please sign in again."};
 let ids:unknown;try{ids=JSON.parse(String(formData.get("ids")??"[]"))}catch{return{status:"error",message:"The selected bank movements could not be read."}}
 if(!Array.isArray(ids)||ids.length===0||ids.length>200||ids.some(id=>typeof id!=="string"||!validUuid(id)))return{status:"error",message:"Choose between 1 and 200 valid bank movements."};
 const s=await createClient(),{data,error}=await s.rpc("bulk_remove_bank_transactions",{p_company_id:w.company.id,p_bank_transaction_ids:ids});if(error)return{status:"error",message:error.message};const result=data&&typeof data==="object"?data as Record<string,unknown>:{},removed=Number(result.removed??0),blocked=Number(result.blocked??0);refresh();return{status:"success",message:`${removed} bank movement${removed===1?"":"s"} removed from active books${blocked?` · ${blocked} payment-linked item${blocked===1?" was":"s were"} protected`:""}. Posted journals were reversed rather than erased.`};
}

export async function removeImportBatch(_previous:BankRemovalState,formData:FormData):Promise<BankRemovalState>{
 const w=await getWorkspace();if(!w.authenticated||!w.company)return{status:"error",message:"Your session expired."};const batchId=String(formData.get("batch_id")??"");if(!validUuid(batchId))return{status:"error",message:"Invalid import batch."};const s=await createClient(),{data:rows,error:loadError}=await s.from("bank_transactions").select("id").eq("company_id",w.company.id).eq("import_batch_id",batchId).neq("match_status","ignored");if(loadError)return{status:"error",message:loadError.message};const ids=(rows??[]).map(r=>r.id);if(!ids.length)return{status:"success",message:"This import batch is already inactive."};let removed=0,blocked=0;for(let i=0;i<ids.length;i+=200){const{data,error}=await s.rpc("bulk_remove_bank_transactions",{p_company_id:w.company.id,p_bank_transaction_ids:ids.slice(i,i+200)});if(error)return{status:"error",message:error.message};const result=data&&typeof data==="object"?data as Record<string,unknown>:{};removed+=Number(result.removed??0);blocked+=Number(result.blocked??0)}refresh();return{status:"success",message:`Import batch removed from active books · ${removed} movement${removed===1?"":"s"}${blocked?` · ${blocked} protected`:""}. The original import history remains auditable.`};
}
