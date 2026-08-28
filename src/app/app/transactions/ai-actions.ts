"use server";

import { revalidatePath } from "next/cache";
import { fiscalYearBounds, getActiveFiscalYear } from "@/lib/fiscal-year";
import { runAiTransactionPipeline } from "@/lib/ai-transaction-pipeline";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { canBookkeep } from "@/lib/permissions";
import { assertActionRateLimit, localizedRateLimitMessage, SecurityRateLimitError } from "@/lib/rate-limit";
import type { TransactionActionState } from "./actions";

function refresh(){for(const path of ["/app","/app/transactions","/app/accounting","/app/reports","/app/vat","/app/taxes","/app/banking","/app/year-end"])revalidatePath(path)}
async function context(){const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return null;const year=await getActiveFiscalYear(workspace.company.fiscal_year_start_month),bounds=fiscalYearBounds(year,workspace.company.fiscal_year_start_month),supabase=await createClient();return{workspace,year,bounds,supabase}}

export async function aiReanalyzePendingTransactions(_previous:TransactionActionState):Promise<TransactionActionState>{
 const ctx=await context();if(!ctx)return{status:"error",message:"Your session expired. Please sign in again."};if(!canBookkeep(ctx.workspace.role))return{status:"error",message:"You do not have permission to re-analyze transactions."};if(!process.env.OPENAI_API_KEY)return{status:"error",message:"OpenAI bookkeeping is not configured on this deployment yet."};const locale=ctx.workspace.profile?.locale==="fr"?"fr":"en";try{await assertActionRateLimit(ctx.supabase,"copilot")}catch(error){return{status:"error",message:error instanceof SecurityRateLimitError?localizedRateLimitMessage(locale,error.retryAfterSeconds):"The security check could not be completed. Please try again."}}
 try{const result=await runAiTransactionPipeline({supabase:ctx.supabase,company:ctx.workspace.company!,start:ctx.bounds.start,end:ctx.bounds.end,maxTransactions:220});refresh();const auto=result.deterministic_posted+result.ai_auto_posted,errors=result.errors.length;return{status:"success",message:`AI reviewed ${result.scanned} pending movement${result.scanned===1?"":"s"} for FY ${ctx.year} · ${auto} high-confidence item${auto===1?"":"s"} posted automatically · ${result.ai_suggested} AI categor${result.ai_suggested===1?"y":"ies"} created · ${result.remaining} still require review${errors?` · ${errors} item${errors===1?"":"s"} could not be updated`:""}.`}}
 catch(error){refresh();return{status:"error",message:error instanceof Error?error.message:"AI bookkeeping analysis failed."}}
}

export async function approveSuggestedForActiveYear(_previous:TransactionActionState):Promise<TransactionActionState>{const ctx=await context();if(!ctx)return{status:"error",message:"Your session expired. Please sign in again."};const{data,error}=await ctx.supabase.rpc("bulk_post_suggested_source_transactions_period",{p_company_id:ctx.workspace.company!.id,p_start:ctx.bounds.start,p_end:ctx.bounds.end,p_min_confidence:.70});if(error)return{status:"error",message:error.message};const result=data&&typeof data==="object"?data as Record<string,unknown>:{};const posted=Number(result.posted??0),remaining=Number(result.remaining??0);refresh();return{status:"success",message:`${posted} FY ${ctx.year} suggestion${posted===1?"":"s"} posted · ${remaining} still need review.`}}
export async function ignorePendingForActiveYear(_previous:TransactionActionState):Promise<TransactionActionState>{const ctx=await context();if(!ctx)return{status:"error",message:"Your session expired. Please sign in again."};const{data,error}=await ctx.supabase.rpc("bulk_ignore_pending_source_transactions_period",{p_company_id:ctx.workspace.company!.id,p_start:ctx.bounds.start,p_end:ctx.bounds.end});if(error)return{status:"error",message:error.message};const count=Number(data??0);refresh();return{status:"success",message:`${count} FY ${ctx.year} transaction${count===1?"":"s"} ignored. Bank evidence is retained.`}}
