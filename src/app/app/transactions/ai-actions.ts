"use server";

import { revalidatePath } from "next/cache";
import { fiscalYearBounds, getActiveFiscalYear } from "@/lib/fiscal-year";
import { runAiTransactionPipeline } from "@/lib/ai-transaction-pipeline";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import type { TransactionActionState } from "./actions";

function refresh(){for(const path of ["/app","/app/transactions","/app/accounting","/app/reports","/app/vat","/app/taxes","/app/banking","/app/year-end"])revalidatePath(path)}

export async function aiReanalyzePendingTransactions(_previous:TransactionActionState):Promise<TransactionActionState>{
 const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};if(!process.env.OPENAI_API_KEY)return{status:"error",message:"OpenAI bookkeeping is not configured on this deployment yet."};
 const year=await getActiveFiscalYear(workspace.company.fiscal_year_start_month),bounds=fiscalYearBounds(year,workspace.company.fiscal_year_start_month),supabase=await createClient();
 try{const result=await runAiTransactionPipeline({supabase,company:workspace.company,start:bounds.start,end:bounds.end,maxTransactions:220});refresh();const auto=result.deterministic_posted+result.ai_auto_posted,errors=result.errors.length;return{status:"success",message:`AI reviewed ${result.scanned} pending movement${result.scanned===1?"":"s"} for FY ${year} · ${auto} high-confidence item${auto===1?"":"s"} posted automatically · ${result.ai_suggested} AI categor${result.ai_suggested===1?"y":"ies"} created · ${result.remaining} still require review${errors?` · ${errors} item${errors===1?"":"s"} could not be updated`:""}.`}}
 catch(error){refresh();return{status:"error",message:error instanceof Error?error.message:"AI bookkeeping analysis failed."}}
}
