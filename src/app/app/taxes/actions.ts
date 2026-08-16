"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export type VatProfileState={status:"idle"|"success"|"error";message:string};

export async function saveVatProfile(_previous:VatProfileState,formData:FormData):Promise<VatProfileState>{
  const workspace=await getWorkspace();
  if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};
  const frequency=String(formData.get("frequency")??"");
  const year=Number(formData.get("year"));
  if(!["annual","quarterly","monthly"].includes(frequency))return{status:"error",message:"Choose the VAT filing frequency assigned to your company."};
  if(!Number.isInteger(year)||year<2000||year>2100)return{status:"error",message:"Invalid financial year."};
  const supabase=await createClient();
  const {error}=await supabase.from("companies").update({vat_filing_frequency:frequency,updated_at:new Date().toISOString()}).eq("id",workspace.company.id);
  if(error)return{status:"error",message:error.message};
  const {error:syncError}=await supabase.rpc("sync_core_compliance_calendar",{p_company_id:workspace.company.id,p_fiscal_year:year});
  if(syncError)return{status:"error",message:`VAT profile saved, but calendar sync failed: ${syncError.message}`};
  revalidatePath("/app");revalidatePath("/app/taxes");revalidatePath("/app/compliance");
  return{status:"success",message:"VAT profile saved. Your filing calendar is now synchronized."};
}
