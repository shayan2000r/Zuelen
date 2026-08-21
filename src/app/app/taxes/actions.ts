"use server";

import { revalidatePath } from "next/cache";
import { hasPremiumAccess } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export type VatProfileState={status:"idle"|"success"|"error";message:string;upgradeRequired?:boolean};
function refresh(){for(const p of ["/app","/app/taxes","/app/compliance","/app/banking","/app/year-end"])revalidatePath(p)}

export async function saveVatProfile(_previous:VatProfileState,formData:FormData):Promise<VatProfileState>{
 const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};
 const frequency=String(formData.get("frequency")??""),year=Number(formData.get("year"));if(!["annual","quarterly","monthly"].includes(frequency))return{status:"error",message:"Choose the VAT filing frequency assigned to your company."};if(!Number.isInteger(year)||year<2000||year>2100)return{status:"error",message:"Invalid financial year."};
 const supabase=await createClient();const{error}=await supabase.from("companies").update({vat_filing_frequency:frequency,updated_at:new Date().toISOString()}).eq("id",workspace.company.id);if(error)return{status:"error",message:error.message};const{error:syncError}=await supabase.rpc("sync_core_compliance_calendar",{p_company_id:workspace.company.id,p_fiscal_year:year});if(syncError)return{status:"error",message:`VAT profile saved, but calendar sync failed: ${syncError.message}`};refresh();return{status:"success",message:"VAT profile saved. Your filing calendar is synchronized."};
}

export async function matchTaxPaymentAction(_previous:VatProfileState,formData:FormData):Promise<VatProfileState>{
 const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company||!workspace.organization)return{status:"error",message:"Your session expired."};
 if(!(await hasPremiumAccess(workspace.organization.id)))return{status:"error",upgradeRequired:true,message:workspace.profile?.locale==="fr"?"Les estimations fiscales restent disponibles avec Basic. Le rapprochement des paiements fiscaux et le suivi des dossiers sont inclus avec Premium.":"Tax estimates remain available on Basic. Matching tax payments and managing tax cases are included with Premium."};
 const taxId=String(formData.get("tax_event_id")??""),bankId=String(formData.get("bank_transaction_id")??"");if(!/^[0-9a-f-]{36}$/i.test(taxId)||!/^[0-9a-f-]{36}$/i.test(bankId))return{status:"error",message:"Choose a valid tax case and bank payment."};const supabase=await createClient();const{error}=await supabase.rpc("match_tax_event_payment",{p_tax_event_id:taxId,p_bank_transaction_id:bankId});if(error)return{status:"error",message:error.message};refresh();return{status:"success",message:"Tax payment matched to the authority notice. The compliance item is now paid."};
}
