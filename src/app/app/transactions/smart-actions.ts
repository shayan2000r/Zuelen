"use server";

import { revalidatePath } from "next/cache";
import type { TransactionActionState } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

function validUuid(value:string){return /^[0-9a-f-]{36}$/i.test(value)}
function refreshBooks(){for(const path of ["/app","/app/transactions","/app/accounting","/app/taxes","/app/vat","/app/banking","/app/year-end","/app/settings/usage"])revalidatePath(path)}

export async function postSmartSourceTransaction(_previous:TransactionActionState,formData:FormData):Promise<TransactionActionState>{
 const workspace=await getWorkspace();
 if(!workspace.authenticated||!workspace.company||!workspace.organization)return{status:"error",message:"Your session expired. Please sign in again."};
 const id=String(formData.get("source_transaction_id")??"").trim(),code=String(formData.get("account_code")??"").trim();
 if(!validUuid(id))return{status:"error",message:"The transaction reference is invalid."};
 if(!/^\d{3,6}$/.test(code))return{status:"error",message:"Choose a valid accounting category."};
 const supabase=await createClient();
 const{data:existing,error:existingError}=await supabase.from("company_accounts").select("id,is_active").eq("company_id",workspace.company.id).eq("code",code).maybeSingle();
 if(existingError)return{status:"error",message:existingError.message};
 if(existing&&!existing.is_active){const{error}=await supabase.from("company_accounts").update({is_active:true}).eq("id",existing.id);if(error)return{status:"error",message:error.message}}
 if(!existing){
  const{data:pcn,error:pcnError}=await supabase.from("pcn_accounts").select("id,code,label_en,label_fr,account_type").eq("code",code).eq("is_active",true).eq("source_version","PCN2020").maybeSingle();
  if(pcnError)return{status:"error",message:pcnError.message};
  if(!pcn)return{status:"error",message:"This accounting category is not part of the active Luxembourg PCN."};
  if(!["expense","revenue","asset","liability","equity"].includes(pcn.account_type))return{status:"error",message:"This PCN account cannot be used for this transaction."};
  const{error:insertError}=await supabase.from("company_accounts").upsert({organization_id:workspace.organization.id,company_id:workspace.company.id,pcn_account_id:pcn.id,code:pcn.code,label:pcn.label_fr,label_en:pcn.label_en,label_fr:pcn.label_fr,account_type:pcn.account_type,is_active:true},{onConflict:"company_id,code"});
  if(insertError)return{status:"error",message:insertError.message};
 }
 const{data,error}=await supabase.rpc("classify_and_post_source_transaction",{p_source_transaction_id:id,p_account_code:code});
 if(error)return{status:"error",message:error.message};
 refreshBooks();
 return{status:"success",message:"Posted successfully. Zuelen will remember this treatment for similar transactions.",journalEntryId:typeof data==="string"?data:undefined};
}
