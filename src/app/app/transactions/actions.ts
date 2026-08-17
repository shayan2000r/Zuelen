"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export type TransactionActionState = {
  status: "idle" | "success" | "error";
  message: string;
  journalEntryId?: string;
};

function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function validUuid(value:string){return /^[0-9a-f-]{36}$/i.test(value)}
function refreshBooks(){revalidatePath("/app");revalidatePath("/app/transactions");revalidatePath("/app/accounting");revalidatePath("/app/taxes");revalidatePath("/app/banking")}

function calculateVat(formData: FormData) {
  const entered = Number(formData.get("amount") ?? formData.get("amount_gross"));
  const rate = Number(formData.get("vat_rate") || 0);
  const included = String(formData.get("vat_included") ?? "yes") !== "no";
  if (!Number.isFinite(entered) || entered <= 0) return { error: "Amount must be greater than zero." } as const;
  if (![0, 3, 8, 14, 17].includes(rate)) return { error: "Choose a supported Luxembourg VAT rate." } as const;
  if (rate === 0) return { gross: roundMoney(entered), net: roundMoney(entered), vat: 0, rate, included } as const;
  if (included) { const gross=roundMoney(entered),net=roundMoney(gross/(1+rate/100)); return {gross,net,vat:roundMoney(gross-net),rate,included} as const; }
  const net=roundMoney(entered),vat=roundMoney(net*rate/100); return {gross:roundMoney(net+vat),net,vat,rate,included} as const;
}

export async function createSourceTransaction(_previous: TransactionActionState, formData: FormData): Promise<TransactionActionState> {
  const workspace=await getWorkspace();
  if(!workspace.authenticated||!workspace.userId||!workspace.organization||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};
  const occurredOn=String(formData.get("occurred_on")??""),direction=String(formData.get("direction")??""),counterparty=String(formData.get("counterparty_name")??"").trim(),description=String(formData.get("description")??"").trim(),vat=calculateVat(formData);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn))return{status:"error",message:"Choose a valid transaction date."};
  if(!["income","expense"].includes(direction))return{status:"error",message:"Choose income or expense."};
  if("error" in vat)return{status:"error",message:vat.error??"VAT calculation failed."};
  if(!workspace.company.vat_registered&&vat.vat>0)return{status:"error",message:"This company is not marked as VAT registered. Choose 0% VAT or update the company VAT profile."};
  const supabase=await createClient();
  const{data,error}=await supabase.from("source_transactions").insert({organization_id:workspace.organization.id,company_id:workspace.company.id,occurred_on:occurredOn,direction,amount_gross:vat.gross,amount_net:vat.net,vat_amount:vat.vat,currency:workspace.company.base_currency||"EUR",counterparty_name:counterparty||null,description:description||null,source_type:"manual",classification_status:"review",created_by:workspace.userId}).select("id").single();
  if(error)return{status:"error",message:error.message};
  if(data?.id)await supabase.rpc("apply_source_transaction_suggestion",{p_source_transaction_id:data.id});
  refreshBooks();
  return{status:"success",message:`Transaction recorded · net ${vat.net.toFixed(2)} · VAT ${vat.vat.toFixed(2)}.`};
}

export async function postSourceTransaction(_previous:TransactionActionState,formData:FormData):Promise<TransactionActionState>{
  const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};
  const sourceTransactionId=String(formData.get("source_transaction_id")??"").trim(),accountCode=String(formData.get("account_code")??"").trim();
  if(!validUuid(sourceTransactionId))return{status:"error",message:"The transaction reference is invalid."};if(!/^\d{3,6}$/.test(accountCode))return{status:"error",message:"Choose a valid accounting category."};
  const supabase=await createClient();const{data,error}=await supabase.rpc("classify_and_post_source_transaction",{p_source_transaction_id:sourceTransactionId,p_account_code:accountCode});if(error)return{status:"error",message:error.message};refreshBooks();return{status:"success",message:"Posted successfully. The journal entry is now locked and auditable.",journalEntryId:typeof data==="string"?data:undefined};
}

export async function recategorizeSourceTransactionAction(_previous:TransactionActionState,formData:FormData):Promise<TransactionActionState>{
  const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};
  const id=String(formData.get("source_transaction_id")??""),accountCode=String(formData.get("account_code")??"").trim();if(!validUuid(id))return{status:"error",message:"Invalid transaction."};if(!/^\d{3,6}$/.test(accountCode))return{status:"error",message:"Choose a valid accounting category."};
  const supabase=await createClient();const{error}=await supabase.rpc("recategorize_source_transaction_safe",{p_source_transaction_id:id,p_account_code:accountCode});if(error)return{status:"error",message:error.message};refreshBooks();return{status:"success",message:"Category corrected. Compta reversed the old posting and created the replacement entry."};
}

export async function editSourceTransactionAction(_previous:TransactionActionState,formData:FormData):Promise<TransactionActionState>{
  const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};
  const id=String(formData.get("source_transaction_id")??""),occurredOn=String(formData.get("occurred_on")??""),direction=String(formData.get("direction")??""),counterparty=String(formData.get("counterparty_name")??"").trim(),description=String(formData.get("description")??"").trim(),vat=calculateVat(formData);
  if(!validUuid(id))return{status:"error",message:"Invalid transaction."};if(!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn))return{status:"error",message:"Choose a valid transaction date."};if(!["income","expense"].includes(direction))return{status:"error",message:"Choose income or expense."};if("error" in vat)return{status:"error",message:vat.error??"VAT calculation failed."};if(!workspace.company.vat_registered&&vat.vat>0)return{status:"error",message:"This company is not marked as VAT registered."};
  const supabase=await createClient();const{error}=await supabase.rpc("update_source_transaction_safe",{p_source_transaction_id:id,p_occurred_on:occurredOn,p_direction:direction,p_amount_gross:vat.gross,p_vat_amount:vat.vat,p_counterparty_name:counterparty||null,p_description:description||null});if(error)return{status:"error",message:error.message};refreshBooks();return{status:"success",message:`Transaction updated · net ${vat.net.toFixed(2)} · VAT ${vat.vat.toFixed(2)}.`};
}

export async function deleteSourceTransactionAction(_previous:TransactionActionState,formData:FormData):Promise<TransactionActionState>{
  const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};const id=String(formData.get("source_transaction_id")??"");if(!validUuid(id))return{status:"error",message:"Invalid transaction."};const supabase=await createClient();const{error}=await supabase.rpc("delete_source_transaction_safe",{p_source_transaction_id:id});if(error)return{status:"error",message:error.message};refreshBooks();return{status:"success",message:"Transaction deleted from active books."};
}
