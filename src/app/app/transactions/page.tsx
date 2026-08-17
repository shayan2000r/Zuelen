import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { redirect } from "next/navigation";
import { SourceTransactionForm } from "@/components/source-transaction-form";
import { TransactionReviewCard } from "@/components/transaction-review-card";
import { TransactionRowActions } from "@/components/transaction-row-actions";
import { TransactionBulkActions } from "@/components/transaction-bulk-actions";
import styles from "@/components/live.module.css";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";
function money(value:number,currency:string){return new Intl.NumberFormat("en-LU",{style:"currency",currency,minimumFractionDigits:2}).format(value)}

export default async function TransactionsPage(){
  const workspace=await getWorkspace(); if(!workspace.authenticated)redirect("/sign-in"); if(!workspace.company)redirect("/setup"); const supabase=await createClient();
  const[{data,error},{data:accountData,error:accountError}]=await Promise.all([
    supabase.from("source_transactions").select("id,occurred_on,direction,amount_gross,amount_net,vat_amount,currency,counterparty_name,description,classification_status,posted_journal_entry_id,suggested_account_id,suggestion_confidence,suggestion_reason,suggestion_kind").eq("company_id",workspace.company.id).not("classification_status","in",'(reversed,ignored)').order("occurred_on",{ascending:false}).order("created_at",{ascending:false}).limit(200),
    supabase.from("company_accounts").select("id,code,label,account_type,is_active").eq("company_id",workspace.company.id).eq("is_active",true).order("code",{ascending:true}),
  ]);
  if(error)throw new Error(`Could not load transactions: ${error.message}`); if(accountError)throw new Error(`Could not load accounting categories: ${accountError.message}`);
  const rows=data??[]; const accounts=(accountData??[]).filter(account=>["expense","revenue","asset","liability"].includes(account.account_type));
  const postedIds=rows.map(row=>row.posted_journal_entry_id).filter((id):id is string=>Boolean(id)); const entryNumbers=new Map<string,number>(); if(postedIds.length>0){const{data:entries}=await supabase.from("journal_entries").select("id,entry_number").in("id",postedIds);for(const entry of entries??[])entryNumbers.set(entry.id,Number(entry.entry_number));}
  const pendingRows=rows.filter(row=>["unclassified","review","classified"].includes(row.classification_status)); const nextReview=pendingRows[0]??null; const suggestedCount=pendingRows.filter(row=>row.suggested_account_id&&Number(row.suggestion_confidence??0)>=.7).length; const unresolvedCount=pendingRows.length-suggestedCount;
  return <div className={styles.liveWrap}>
    <div className={styles.liveIntro}><div><p className={styles.eyebrow}>Bookkeeping source</p><h1>Transactions</h1><p>Compta suggests a PCN treatment when the evidence is strong, explains why, and leaves ambiguous movements for review instead of guessing.</p></div><span className={styles.liveBadge}><span>{pendingRows.length}</span> to review · {rows.length} active</span></div>
    {pendingRows.length>0?<div style={{marginBottom:14}}><TransactionBulkActions suggestedCount={suggestedCount} unresolvedCount={unresolvedCount}/></div>:null}
    <section className={styles.transactionLayout}><SourceTransactionForm/><div className={styles.transactionRight}>
      {nextReview?<TransactionReviewCard transaction={nextReview} accounts={accounts}/>:<article className={styles.reviewCard}><div className={styles.emptyState}><h3>Accounting inbox cleared.</h3><p>Every recorded transaction has been classified and posted. New activity will appear here for review.</p></div></article>}
      <article className={styles.ledgerPanel}><div className={styles.ledgerHead}><div><p className={styles.eyebrow}>Activity log</p><h2>Recorded transactions</h2></div><span>Suggestions stay reviewable</span></div>
      {rows.length===0?<div className={styles.emptyState}><h3>No transactions yet.</h3><p>Use the form or import a bank statement to create the first activity.</p></div>:<table className={styles.ledgerTable}><thead><tr><th>Date</th><th>Transaction</th><th>Status</th><th>Amount</th><th aria-label="Actions"/></tr></thead><tbody>{rows.map(row=>{const income=row.direction==="income",entryNumber=row.posted_journal_entry_id?entryNumbers.get(row.posted_journal_entry_id):undefined,suggested=row.suggested_account_id?accounts.find(a=>a.id===row.suggested_account_id):undefined;return <tr key={row.id}><td>{new Date(`${row.occurred_on}T12:00:00`).toLocaleDateString("en-LU",{day:"2-digit",month:"short"})}</td><td className={styles.ledgerName}><strong>{row.counterparty_name||row.description||(row.suggestion_kind==="refund_candidate"?"Possible refund":income?"Income":"Expense")}</strong><small>{row.classification_status!=="posted"&&suggested?`${row.suggestion_kind==="refund_candidate"?"Possible refund · ":""}Suggested ${suggested.code} · ${suggested.label} · ${Math.round(Number(row.suggestion_confidence??0)*100)}%`:row.amount_net!==null?`Net ${money(Number(row.amount_net),row.currency)}${row.vat_amount?` · VAT ${money(Number(row.vat_amount),row.currency)}`:""}`:""}</small></td><td><span className={`${styles.rowStatus} ${row.classification_status==="posted"?styles.postedStatus:""}`}>{row.classification_status==="posted"?`Posted${entryNumber?` · J${String(entryNumber).padStart(4,"0")}`:""}`:suggested?"Suggested":"Review"}</span></td><td className={income?styles.incomeAmount:styles.expenseAmount}>{income?<ArrowUpRight size={12}/>:<ArrowDownLeft size={12}/>} {income?"+":"−"}{money(Number(row.amount_gross),row.currency)}</td><td><TransactionRowActions row={row} accounts={accounts}/></td></tr>})}</tbody></table>}
      </article></div></section>
  </div>;
}
