"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export type AccountingActionState={status:"idle"|"success"|"error";message:string};
function validUuid(value:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)}
function refreshAccounting(){revalidatePath("/app");revalidatePath("/app/accounting");revalidatePath("/app/invoices");revalidatePath("/app/transactions");revalidatePath("/app/banking");revalidatePath("/app/taxes");}

export async function resetBookkeepingAction(_previous:AccountingActionState,formData:FormData):Promise<AccountingActionState>{
  const workspace=await getWorkspace(); if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};
  const confirmation=String(formData.get("confirmation")??"").trim(); if(!confirmation)return{status:"error",message:"Type the exact company legal name to confirm."};
  const supabase=await createClient(); const{data,error}=await supabase.rpc("reset_company_bookkeeping",{p_company_id:workspace.company.id,p_confirmation:confirmation}); if(error)return{status:"error",message:error.message}; const counts=data&&typeof data==="object"?data as Record<string,unknown>:{}; refreshAccounting(); return{status:"success",message:`Bookkeeping reset complete · ${Number(counts.transactions??0)} transactions, ${Number(counts.journals??0)} journals and ${Number(counts.bank_rows??0)} bank rows cleared.`};
}

export async function undoInvoicePaymentAction(_previous:AccountingActionState,formData:FormData):Promise<AccountingActionState>{
  const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};const paymentId=String(formData.get("payment_id")??"").trim();if(!validUuid(paymentId))return{status:"error",message:"Invalid payment reference."};const supabase=await createClient();const{error}=await supabase.rpc("undo_invoice_payment_safe",{p_payment_id:paymentId});if(error)return{status:"error",message:error.message};refreshAccounting();return{status:"success",message:"Payment undone. The original journal entry was reversed."};
}

export async function editInvoicePaymentAction(_previous:AccountingActionState,formData:FormData):Promise<AccountingActionState>{
  const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};const paymentId=String(formData.get("payment_id")??"").trim(),amount=Number(formData.get("amount")),paidOn=String(formData.get("paid_on")??""),reference=String(formData.get("reference")??"").trim();if(!validUuid(paymentId))return{status:"error",message:"Invalid payment reference."};if(!Number.isFinite(amount)||amount<=0)return{status:"error",message:"Payment amount must be greater than zero."};if(!/^\d{4}-\d{2}-\d{2}$/.test(paidOn))return{status:"error",message:"Choose a valid payment date."};const supabase=await createClient();const{error}=await supabase.rpc("correct_manual_invoice_payment_safe",{p_payment_id:paymentId,p_amount:amount,p_paid_on:paidOn,p_reference:reference||null});if(error)return{status:"error",message:error.message};refreshAccounting();return{status:"success",message:"Payment corrected. Compta reversed the old entry and posted the replacement."};
}
