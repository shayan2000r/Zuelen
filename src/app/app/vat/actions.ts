"use server";

import { revalidatePath } from "next/cache";
import { hasPremiumAccess } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export type VatFilingState={status:"idle"|"success"|"error";message:string;filingId?:string;upgradeRequired?:boolean};
export async function prepareVatFilingAction(_previous:VatFilingState,formData:FormData):Promise<VatFilingState>{
 const w=await getWorkspace();if(!w.authenticated||!w.company||!w.organization||!w.capabilities?.hasVat)return{status:"error",message:"VAT is not configured for the active workspace."};
 if(!(await hasPremiumAccess(w.organization.id)))return{status:"error",upgradeRequired:true,message:w.profile?.locale==="fr"?"Votre position TVA reste visible avec Basic. La préparation d’une déclaration TVA figée est incluse avec Premium.":"Your VAT position remains visible on Basic. Preparing a frozen VAT filing is included with Premium."};
 const start=String(formData.get("period_start")??""),end=String(formData.get("period_end")??"");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end))return{status:"error",message:"Choose a valid VAT period."};
 const s=await createClient();const{data,error}=await s.rpc("prepare_vat_filing",{p_company_id:w.company.id,p_period_start:start,p_period_end:end});if(error)return{status:"error",message:error.message};
 for(const p of ["/app","/app/vat","/app/taxes","/app/compliance"])revalidatePath(p);
 return{status:"success",message:"VAT filing snapshot prepared from the posted ledger. Review the evidence before marking it filed.",filingId:typeof data==="string"?data:undefined};
}
