import { ArrowDownLeft, ArrowRight, ArrowUpRight, CheckCircle2, CircleDollarSign, Landmark, Link2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BankImporter } from "@/components/bank-importer";
import styles from "@/components/banking.module.css";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";
function money(value:number,currency:string){return new Intl.NumberFormat("en-LU",{style:"currency",currency,minimumFractionDigits:2}).format(value)}

export default async function BankingPage(){
  const workspace=await getWorkspace(); if(!workspace.authenticated)redirect("/sign-in"); if(!workspace.company)redirect("/setup");
  const supabase=await createClient();
  const [accountsResult,bankResult,batchesResult,bankLedgerResult]=await Promise.all([
    supabase.from("bank_accounts").select("id,name,iban,currency,opening_balance").eq("company_id",workspace.company.id).order("created_at"),
    supabase.from("bank_transactions").select("id,bank_account_id,booking_date,amount,currency,counterparty_name,reference,match_status,matched_journal_entry_id,import_source").eq("company_id",workspace.company.id).order("booking_date",{ascending:false}).limit(300),
    supabase.from("bank_import_batches").select("id,file_name,row_count,imported_count,duplicate_count,created_at").eq("company_id",workspace.company.id).order("created_at",{ascending:false}).limit(8),
    supabase.from("journal_lines").select("debit,credit,company_account_id,company_accounts!inner(code,company_id)").eq("company_accounts.company_id",workspace.company.id).eq("company_accounts.code","5131"),
  ]);
  if(accountsResult.error)throw new Error(`Could not load bank accounts: ${accountsResult.error.message}`); if(bankResult.error)throw new Error(`Could not load bank transactions: ${bankResult.error.message}`); if(batchesResult.error)throw new Error(`Could not load bank imports: ${batchesResult.error.message}`); if(bankLedgerResult.error)throw new Error(`Could not load bank ledger: ${bankLedgerResult.error.message}`);
  const accounts=accountsResult.data??[],rows=bankResult.data??[],batches=batchesResult.data??[],currency=workspace.company.base_currency||"EUR";
  const importedMovement=rows.reduce((sum,row)=>sum+Number(row.amount),0); const bookMovement=(bankLedgerResult.data??[]).reduce((sum,line)=>sum+Number(line.debit)-Number(line.credit),0); const difference=Math.round((importedMovement-bookMovement)*100)/100;
  const matched=rows.filter(row=>row.match_status==="matched").length,unmatched=rows.filter(row=>row.match_status!=="matched").length,coverage=rows.length?Math.round(matched/rows.length*100):100;
  const accountMap=new Map(accounts.map(account=>[account.id,account]));
  return <div className={styles.page}>
    <div className={styles.intro}><div><p>Cash → books</p><h1>Banking</h1><span>Import statement activity once, then reconcile each movement to invoices or the ledger without double-booking cash.</span></div><div className={styles.health}><CheckCircle2 size={14}/>{coverage}% reconciled</div></div>
    <section className={styles.metrics}><article><span><Landmark size={14}/>Imported movement</span><strong>{money(importedMovement,currency)}</strong><small>{rows.length} statement movements</small></article><article><span><CircleDollarSign size={14}/>Posted bank movement</span><strong>{money(bookMovement,currency)}</strong><small>Ledger account 5131</small></article><article className={Math.abs(difference)<0.01?styles.goodMetric:styles.warnMetric}><span><RefreshCw size={14}/>Difference</span><strong>{money(difference,currency)}</strong><small>{Math.abs(difference)<0.01?"Bank activity reconciles":"Unposted or unmatched activity remains"}</small></article><article><span><Link2 size={14}/>Coverage</span><strong>{coverage}%</strong><small>{matched} matched · {unmatched} open</small></article></section>
    <section className={styles.layout}><BankImporter defaultCurrency={currency}/><div className={styles.right}>
      <article className={styles.panel}><div className={styles.panelHead}><div><p>Reconciliation queue</p><h2>Bank movements</h2></div><Link href="/app/transactions" className={styles.reviewLink}>Review accounting <ArrowRight size={13}/></Link></div>
        {rows.length===0?<div className={styles.empty}><h3>No bank activity yet.</h3><p>Export a CSV from your bank and import it here. Compta will create reviewable transactions automatically.</p></div>:<div className={styles.tableWrap}><table><thead><tr><th>Date</th><th>Movement</th><th>Account</th><th>Status</th><th>Amount</th></tr></thead><tbody>{rows.map(row=>{const positive=Number(row.amount)>=0,account=accountMap.get(row.bank_account_id);return <tr key={row.id}><td>{new Date(`${row.booking_date}T12:00:00`).toLocaleDateString("en-LU",{day:"2-digit",month:"short"})}</td><td><strong>{row.counterparty_name||row.reference||"Bank movement"}</strong><small>{row.reference&&row.counterparty_name?row.reference:"CSV import"}</small></td><td><span>{account?.name||"Bank"}</span></td><td><em className={row.match_status==="matched"?styles.matched:styles.open}>{row.match_status==="matched"?"Matched":"Review"}</em></td><td className={positive?styles.moneyIn:styles.moneyOut}>{positive?<ArrowUpRight size={12}/>:<ArrowDownLeft size={12}/>} {positive?"+":"−"}{money(Math.abs(Number(row.amount)),row.currency)}</td></tr>})}</tbody></table></div>}
      </article>
      <article className={styles.importHistory}><div><p>Import history</p><h2>Recent batches</h2></div>{batches.length===0?<span>No imports yet</span>:<div className={styles.batchList}>{batches.map(batch=><div key={batch.id}><strong>{batch.file_name||"Bank CSV"}</strong><span>{batch.imported_count} imported · {batch.duplicate_count} skipped</span><small>{new Date(batch.created_at).toLocaleString("en-LU",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</small></div>)}</div>}</article>
    </div></section>
  </div>;
}
