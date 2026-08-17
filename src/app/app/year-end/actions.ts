"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export type ClosingState={status:"idle"|"success"|"error";message:string;filingId?:string};

export async function createClosingSnapshot(_previous:ClosingState):Promise<ClosingState>{
 const w=await getWorkspace();if(!w.authenticated||!w.userId||!w.company||!w.organization)return{status:"error",message:"Your session expired. Please sign in again."};
 const s=await createClient(),year=new Date().getFullYear(),from=`${year}-01-01`,to=`${year}-12-31`;
 const [pending,bank,drafts,docs,vat,entries,accounts]=await Promise.all([
  s.from("source_transactions").select("id",{count:"exact",head:true}).eq("company_id",w.company.id).in("classification_status",["unclassified","review","classified"]).gte("occurred_on",from).lte("occurred_on",to),
  s.from("bank_transactions").select("id",{count:"exact",head:true}).eq("company_id",w.company.id).neq("match_status","matched").gte("booking_date",from).lte("booking_date",to),
  s.from("sales_invoices").select("id",{count:"exact",head:true}).eq("company_id",w.company.id).eq("status","draft"),
  s.from("documents").select("id",{count:"exact",head:true}).eq("company_id",w.company.id).in("extraction_status",["failed","needs_review","processing"]),
  s.from("source_transactions").select("id",{count:"exact",head:true}).eq("company_id",w.company.id).neq("classification_status","posted").gt("vat_amount",0).gte("occurred_on",from).lte("occurred_on",to),
  s.from("journal_entries").select("id,entry_number,entry_date,status").eq("company_id",w.company.id).eq("status","posted").gte("entry_date",from).lte("entry_date",to).order("entry_number"),
  s.from("company_accounts").select("id,code,label,account_type").eq("company_id",w.company.id).eq("is_active",true).order("code")
 ]);
 if([pending,bank,drafts,docs,vat,entries,accounts].some(r=>r.error))return{status:"error",message:"Compta could not complete the closing checks."};
 const blockers=(pending.count??0)+(bank.count??0)+(drafts.count??0)+(docs.count??0)+(vat.count??0);if(blockers>0)return{status:"error",message:`${blockers} closing blocker${blockers===1?" remains":"s remain"}. Clear the Year-end checklist first.`};
 const entryIds=(entries.data??[]).map(e=>e.id),lines=entryIds.length?(await s.from("journal_lines").select("journal_entry_id,company_account_id,debit,credit,currency").in("journal_entry_id",entryIds)).data??[]:[];
 const entryBalance=new Map<string,{d:number;c:number}>(),accountBalance=new Map<string,{d:number;c:number}>();for(const l of lines){const e=entryBalance.get(l.journal_entry_id)??{d:0,c:0};e.d+=Number(l.debit);e.c+=Number(l.credit);entryBalance.set(l.journal_entry_id,e);const a=accountBalance.get(l.company_account_id)??{d:0,c:0};a.d+=Number(l.debit);a.c+=Number(l.credit);accountBalance.set(l.company_account_id,a)}
 if([...entryBalance.values()].some(x=>Math.abs(x.d-x.c)>.005))return{status:"error",message:"At least one posted journal entry is unbalanced. Closing is blocked."};
 const trialBalance=(accounts.data??[]).map(a=>{const x=accountBalance.get(a.id)??{d:0,c:0};return{code:a.code,label:a.label,account_type:a.account_type,debit:Number(x.d.toFixed(2)),credit:Number(x.c.toFixed(2)),balance:Number((x.d-x.c).toFixed(2))}}).filter(r=>r.debit||r.credit);
 const revenue=trialBalance.filter(r=>r.account_type==="revenue").reduce((n,r)=>n+r.credit-r.debit,0),expenses=trialBalance.filter(r=>r.account_type==="expense").reduce((n,r)=>n+r.debit-r.credit,0),result=Number((revenue-expenses).toFixed(2));
 const snapshot={company_id:w.company.id,period_start:from,period_end:to,entry_count:entryIds.length,entries:(entries.data??[]).map(e=>({id:e.id,number:e.entry_number,date:e.entry_date})),trial_balance:trialBalance,profit_and_loss:{revenue:Number(revenue.toFixed(2)),expenses:Number(expenses.toFixed(2)),result}};
 const checksum=createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),now=new Date().toISOString();
 const{data:filing,error}=await s.from("filings").insert({organization_id:w.organization.id,company_id:w.company.id,filing_type:"annual_accounts",period_label:String(year),status:"draft",schema_version:null,rules_version:"LU-2026.1|PCN2020",payload:{stage:"closing_snapshot",ecdf:{status:"schema_required"}},ledger_snapshot:snapshot,period_start:from,period_end:to,snapshot_at:now,ledger_checksum:checksum,export_status:"schema_required",created_by:w.userId}).select("id").single();
 if(error||!filing)return{status:"error",message:error?.message??"The closing snapshot could not be created."};
 await s.from("accounting_periods").update({status:"soft_closed"}).eq("company_id",w.company.id).eq("starts_on",from).eq("ends_on",to).eq("status","open");
 revalidatePath("/app/year-end");revalidatePath("/app/reports");revalidatePath("/app/ecdf");
 return{status:"success",message:`Closing snapshot created · ${trialBalance.length} trial-balance accounts frozen for review.`,filingId:filing.id};
}
