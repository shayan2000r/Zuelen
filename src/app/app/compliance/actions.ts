"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {getWorkspace} from "@/lib/workspace";
export type ComplianceState={status:"idle"|"success"|"error";message:string};
export async function syncComplianceCalendar(_previous:ComplianceState,formData:FormData):Promise<ComplianceState>{const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired."};const year=Number(formData.get("year"));if(!Number.isInteger(year)||year<2000||year>2100)return{status:"error",message:"Invalid financial year."};const supabase=await createClient();const{data,error}=await supabase.rpc("sync_core_compliance_calendar",{p_company_id:workspace.company.id,p_fiscal_year:year});if(error)return{status:"error",message:error.message};revalidatePath("/app");revalidatePath("/app/taxes");revalidatePath("/app/compliance");return{status:"success",message:`Calendar synchronized · ${Number(data??0)} rule slots checked.`};}
