"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { canManageOrganization } from "@/lib/permissions";

export type SettingsState={status:"idle"|"success"|"error";message:string};
function text(formData:FormData,key:string){return String(formData.get(key)??"").trim()}
export async function saveCompanySettings(_previous:SettingsState,formData:FormData):Promise<SettingsState>{
 const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};if(!canManageOrganization(workspace.role))return{status:"error",message:"Only an Owner or Admin can change the company profile."};
 const legalName=text(formData,"legal_name"),legalForm=text(formData,"legal_form"),tradingName=text(formData,"trading_name"),rcs=text(formData,"rcs_number"),vat=text(formData,"vat_number"),tax=text(formData,"tax_number"),permit=text(formData,"business_permit_number"),municipality=text(formData,"municipality"),activity=text(formData,"activity"),street=text(formData,"street"),postal=text(formData,"postal_code"),city=text(formData,"city"),country=text(formData,"country_code").toUpperCase()||"LU",currency=text(formData,"base_currency").toUpperCase()||"EUR",frequency=text(formData,"vat_filing_frequency"),fiscalMonth=Number(formData.get("fiscal_year_start_month")??1),vatRegistered=formData.get("vat_registered")==="on";
 if(legalName.length<2)return{status:"error",message:"Enter the legal company name."};if(!legalForm)return{status:"error",message:"Choose the legal form."};if(!Number.isInteger(fiscalMonth)||fiscalMonth<1||fiscalMonth>12)return{status:"error",message:"Choose a valid fiscal-year start month."};if(!/^[A-Z]{3}$/.test(currency))return{status:"error",message:"Use a valid 3-letter base currency."};if(vatRegistered&&!vat)return{status:"error",message:"Enter the VAT number or turn off VAT registration."};if(frequency&&!["annual","quarterly","monthly"].includes(frequency))return{status:"error",message:"Choose a valid VAT filing frequency."};if(country&&!/^[A-Z]{2}$/.test(country))return{status:"error",message:"Use a two-letter country code."};
 const supabase=await createClient();const{error}=await supabase.from("companies").update({legal_name:legalName,trading_name:tradingName||null,legal_form:legalForm,rcs_number:rcs||null,vat_number:vat||null,tax_number:tax||null,business_permit_number:permit||null,municipality:municipality||city||null,activity:activity||null,fiscal_year_start_month:fiscalMonth,base_currency:currency,vat_registered:vatRegistered,vat_filing_frequency:vatRegistered?(frequency||null):null,registered_address:{street,postal_code:postal,city,country_code:country},updated_at:new Date().toISOString()}).eq("id",workspace.company.id);if(error)return{status:"error",message:error.message};
 for(const path of["/app","/app/settings","/app/invoices","/app/taxes","/app/vat","/app/compliance","/app/copilot"])revalidatePath(path);return{status:"success",message:"Company profile saved."};
}
