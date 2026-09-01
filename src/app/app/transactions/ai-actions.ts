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
const riskyBulkKind=/tax|shareholder|loan|asset|vehicle|personal|cash|transfer|registry|capital|refund/i;

export async function aiReanalyzePendingTransactions(_previous:TransactionActionState):Promise<TransactionActionState>{
 const ctx=await context();if(!ctx)return{status:"error",message:"Your session expired. Please sign in again."};if(!canBookkeep(ctx.workspace.role))return{status:"error",message:"You do not have permission to re-analyze transactions."};if(!process.env.OPENAI_API_KEY)return{status:"error",message:"OpenAI bookkeeping is not configured on this deployment yet."};const locale=ctx.workspace.profile?.locale==="fr"?"fr":"en";try{await assertActionRateLimit(ctx.supabase,"copilot")}catch(error){return{status:"error",message:error instanceof SecurityRateLimitError?localizedRateLimitMessage(locale,error.retryAfterSeconds):"The security check could not be completed. Please try again."}}
 try{const result=await runAiTransactionPipeline({supabase:ctx.supabase,company:ctx.workspace.company!,start:ctx.bounds.start,end:ctx.bounds.end,maxTransactions:220});refresh();const auto=result.deterministic_posted+result.ai_auto_posted,errors=result.errors.length;return{status:"success",message:`AI reviewed ${result.scanned} pending movement${result.scanned===1?"":"s"} for FY ${ctx.year} · ${auto} high-confidence item${auto===1?"":"s"} posted automatically · ${result.ai_suggested} AI categor${result.ai_suggested===1?"y":"ies"} created · ${result.remaining} still require review${errors?` · ${errors} item${errors===1?"":"s"} could not be updated`:""}.`}}
 catch(error){refresh();return{status:"error",message:error instanceof Error?error.message:"AI bookkeeping analysis failed."}}
}

export async function approveSuggestedForActiveYear(_previous:TransactionActionState):Promise<TransactionActionState>{
 const ctx=await context();if(!ctx)return{status:"error",message:"Your session expired. Please sign in again."};if(!canBookkeep(ctx.workspace.role))return{status:"error",message:"You do not have permission to post transactions."};
 const{data:rows,error}=await ctx.supabase.from("source_transactions").select("id,suggested_account_id,suggestion_confidence,suggestion_kind").eq("company_id",ctx.workspace.company!.id).gte("occurred_on",ctx.bounds.start).lte("occurred_on",ctx.bounds.end).in("classification_status",["unclassified","review","classified"]);if(error)return{status:"error",message:error.message};
 const accountIds=(rows??[]).map(row=>row.suggested_account_id).filter((id):id is string=>Boolean(id));const accountMap=new Map<string,{code:string;account_type:string}>();if(accountIds.length){const{data:accounts,error:accountError}=await ctx.supabase.from("company_accounts").select("id,code,account_type").in("id",accountIds);if(accountError)return{status:"error",message:accountError.message};for(const account of accounts??[])accountMap.set(account.id,{code:account.code,account_type:account.account_type})}
 const eligible=(rows??[]).filter(row=>{const account=row.suggested_account_id?accountMap.get(row.suggested_account_id):null;return Number(row.suggestion_confidence??0)>=.95&&Boolean(account)&&["expense","revenue"].includes(account!.account_type)&&!riskyBulkKind.test(row.suggestion_kind??"")});
 let posted=0;const errors:string[]=[];for(const row of eligible){const account=row.suggested_account_id?accountMap.get(row.suggested_account_id):null;if(!account)continue;const{error:postError}=await ctx.supabase.rpc("classify_and_post_source_transaction",{p_source_transaction_id:row.id,p_account_code:account.code});if(postError)errors.push(postError.message);else posted++}
 const{count}=await ctx.supabase.from("source_transactions").select("id",{count:"exact",head:true}).eq("company_id",ctx.workspace.company!.id).gte("occurred_on",ctx.bounds.start).lte("occurred_on",ctx.bounds.end).in("classification_status",["unclassified","review","classified"]);refresh();const remaining=Number(count??0);if(errors.length)return{status:"error",message:`${posted} high-confidence suggestion${posted===1?"":"s"} posted; ${errors.length} could not be posted. ${remaining} still need review.`};return{status:"success",message:`${posted} high-confidence suggestion${posted===1?"":"s"} posted · ${remaining} still need review.`}
}
export async function ignorePendingForActiveYear(_previous:TransactionActionState):Promise<TransactionActionState>{const ctx=await context();if(!ctx)return{status:"error",message:"Your session expired. Please sign in again."};const{data,error}=await ctx.supabase.rpc("bulk_ignore_pending_source_transactions_period",{p_company_id:ctx.workspace.company!.id,p_start:ctx.bounds.start,p_end:ctx.bounds.end});if(error)return{status:"error",message:error.message};const count=Number(data??0);refresh();return{status:"success",message:`${count} FY ${ctx.year} transaction${count===1?"":"s"} ignored. Bank evidence is retained.`}}
