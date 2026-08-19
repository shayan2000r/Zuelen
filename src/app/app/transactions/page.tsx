import { CheckCircle2, Search } from "lucide-react";
import { redirect } from "next/navigation";
import { SourceTransactionForm } from "@/components/source-transaction-form";
import { TransactionReviewCard } from "@/components/transaction-review-card";
import { TransactionBulkActions } from "@/components/transaction-bulk-actions";
import { TransactionTable } from "@/components/transaction-table";
import { defaultDateForFiscalYear, fiscalYearBounds, getActiveFiscalYear } from "@/lib/fiscal-year";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import styles from "./transactions.module.css";

export const dynamic="force-dynamic";
type SearchParams=Promise<{q?:string;status?:string}>;
export default async function TransactionsPage({searchParams}:{searchParams:SearchParams}){
 const params=await searchParams,q=(params.q??"").trim().toLowerCase(),status=params.status??"all";const workspace=await getWorkspace();if(!workspace.authenticated)redirect("/sign-in");if(!workspace.company)redirect("/setup");const year=await getActiveFiscalYear(workspace.company.fiscal_year_start_month),bounds=fiscalYearBounds(year,workspace.company.fiscal_year_start_month),defaultDate=defaultDateForFiscalYear(year,workspace.company.fiscal_year_start_month),supabase=await createClient();
 const[{data,error},{data:accountData,error:accountError}]=await Promise.all([
  supabase.from("source_transactions").select("id,occurred_on,direction,amount_gross,amount_net,vat_amount,vat_rate,vat_treatment,counterparty_country,currency,counterparty_name,description,classification_status,posted_journal_entry_id,suggested_account_id,suggestion_confidence,suggestion_reason,suggestion_kind").eq("company_id",workspace.company.id).not("classification_status","in",'(reversed,ignored)').gte("occurred_on",bounds.start).lte("occurred_on",bounds.end).order("occurred_on",{ascending:false}).order("created_at",{ascending:false}).limit(500),
  supabase.from("company_accounts").select("id,code,label,account_type,is_active").eq("company_id",workspace.company.id).eq("is_active",true).order("code",{ascending:true})]);
 if(error)throw new Error(`Could not load transactions: ${error.message}`);if(accountError)throw new Error(`Could not load accounting categories: ${accountError.message}`);const rows=data??[],accounts=(accountData??[]).filter(a=>["expense","revenue","asset","liability"].includes(a.account_type));
 const postedIds=rows.map(r=>r.posted_journal_entry_id).filter((id):id is string=>Boolean(id)),entryNumbers=new Map<string,number>();if(postedIds.length){const{data:entries}=await supabase.from("journal_entries").select("id,entry_number").in("id",postedIds);for(const e of entries??[])entryNumbers.set(e.id,Number(e.entry_number))}
 const pendingRows=rows.filter(r=>["unclassified","review","classified"].includes(r.classification_status)),nextReview=pendingRows[0]??null,suggestedCount=pendingRows.filter(r=>r.suggested_account_id&&Number(r.suggestion_confidence??0)>=.7).length,unresolvedCount=pendingRows.length-suggestedCount;
 const visibleRows=rows.filter(r=>{const statusMatch=status==="all"||(status==="posted"?r.classification_status==="posted":status==="review"?r.classification_status!=="posted":true);if(!statusMatch)return false;if(!q)return true;return[r.counterparty_name,r.description,r.currency,r.classification_status,r.vat_treatment,r.counterparty_country].filter(Boolean).join(" ").toLowerCase().includes(q)}).map(row=>{const suggested=row.suggested_account_id?accounts.find(a=>a.id===row.suggested_account_id):undefined;return{...row,entry_number:row.posted_journal_entry_id?entryNumbers.get(row.posted_journal_entry_id)??null:null,suggested_code:suggested?.code??null,suggested_label:suggested?.label??null}});
 return <div className={styles.page}>
  <div className={styles.intro}><div><p>Bookkeeping source · {year}</p><h1>Transactions</h1><h2>Review, classify and manage {year} activity without losing the audit trail.</h2></div><span className={styles.badge}><b>{pendingRows.length}</b> to review · {rows.length} active</span></div>
  <SourceTransactionForm defaultDate={defaultDate}/>
  {pendingRows.length?<div className={styles.bulkWrap}><TransactionBulkActions suggestedCount={suggestedCount} unresolvedCount={unresolvedCount}/></div>:null}
  {nextReview?<div className={styles.bulkWrap}><TransactionReviewCard transaction={nextReview} accounts={accounts}/></div>:<div className={styles.reviewBanner}><span><CheckCircle2 size={16}/></span><div><strong>{year} accounting inbox cleared</strong><small>Every active transaction in this financial year has been classified and posted.</small></div></div>}
  <section className={styles.panel}><div className={styles.panelHead}><div><p>Activity log · {year}</p><h2>Recorded transactions</h2></div><span>{visibleRows.length} shown · newest first</span></div>
   <form className={styles.tools} method="get"><label><Search size={15}/><input name="q" defaultValue={params.q??""} placeholder={`Search ${year} transactions`}/></label><select name="status" defaultValue={status}><option value="all">All statuses</option><option value="review">Needs review</option><option value="posted">Posted</option></select><button type="submit">Apply filters</button></form>
   {visibleRows.length===0?<div className={styles.empty}>{rows.length?"No transactions match these filters.":`No transactions in financial year ${year} yet. Use the floating button to add your first one.`}</div>:<TransactionTable rows={visibleRows} accounts={accounts}/>} 
  </section>
 </div>;
}
