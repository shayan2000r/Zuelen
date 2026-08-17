import { ArrowDownLeft, ArrowUpRight, CalendarDays, CheckCircle2, Landmark, Plus, ReceiptText, ShieldCheck, Upload, WalletCards } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OverviewChart } from "@/components/overview-chart";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import styles from "./overview.module.css";

export const dynamic="force-dynamic";
type LedgerLine={journal_entry_id:string;company_account_id:string;debit:number|string;credit:number|string};
type LedgerAccount={id:string;code:string;account_type:string};

function money(value:number,currency="EUR"){
  return new Intl.NumberFormat("en-LU",{style:"currency",currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
}
function clamp(value:number,min:number,max:number){return Math.min(max,Math.max(min,value))}
function title(value:string){return value.replaceAll("_"," ").replace(/\b\w/g,char=>char.toUpperCase())}

export default async function LiveOverviewPage(){
  const workspace=await getWorkspace();
  if(!workspace.authenticated)redirect("/sign-in");
  if(!workspace.company)redirect("/setup");

  const now=new Date();
  const year=now.getFullYear();
  const currency=workspace.company.base_currency||"EUR";
  const supabase=await createClient();
  const [transactionsResult,entriesResult,accountsResult,invoicesResult,obligationsResult]=await Promise.all([
    supabase.from("source_transactions").select("id,occurred_on,direction,amount_gross,amount_net,vat_amount,currency,counterparty_name,description,classification_status").eq("company_id",workspace.company.id).gte("occurred_on",`${year}-01-01`).lte("occurred_on",`${year}-12-31`).order("occurred_on",{ascending:false}),
    supabase.from("journal_entries").select("id,entry_number").eq("company_id",workspace.company.id).eq("status","posted").gte("entry_date",`${year}-01-01`).lte("entry_date",`${year}-12-31`),
    supabase.from("company_accounts").select("id,code,account_type").eq("company_id",workspace.company.id),
    supabase.from("sales_invoices").select("id,invoice_number,total,due_date,payment_status,customer_snapshot").eq("company_id",workspace.company.id).eq("status","issued").order("due_date",{ascending:true}),
    supabase.from("compliance_obligations").select("id,authority,obligation_type,due_date,amount,currency,status,period_label").eq("company_id",workspace.company.id).not("status","in",'(paid,filed,not_applicable)').order("due_date",{ascending:true,nullsFirst:false}).limit(5),
  ]);
  for(const result of [transactionsResult,entriesResult,accountsResult,invoicesResult,obligationsResult]) if(result.error) throw new Error(result.error.message);

  const rows=transactionsResult.data??[];
  const entries=entriesResult.data??[];
  const accounts=(accountsResult.data??[]) as LedgerAccount[];
  const invoices=invoicesResult.data??[];
  const obligations=obligationsResult.data??[];
  const accountMap=new Map(accounts.map(account=>[account.id,account]));

  let lines:LedgerLine[]=[];
  if(entries.length){
    const result=await supabase.from("journal_lines").select("journal_entry_id,company_account_id,debit,credit").in("journal_entry_id",entries.map(entry=>entry.id));
    if(result.error)throw new Error(result.error.message);
    lines=(result.data??[]) as LedgerLine[];
  }

  let revenue=0,expenses=0,outputVat=0,inputVat=0,bank=0,receivables=0;
  for(const line of lines){
    const account=accountMap.get(line.company_account_id); if(!account)continue;
    const debit=Number(line.debit),credit=Number(line.credit);
    if(account.account_type==="revenue")revenue+=credit-debit;
    if(account.account_type==="expense")expenses+=debit-credit;
    if(account.code==="461411")outputVat+=credit-debit;
    if(account.code==="421611")inputVat+=debit-credit;
    if(account.code==="5131")bank+=debit-credit;
    if(account.code==="4011")receivables+=debit-credit;
  }

  const pending=rows.filter(row=>row.classification_status!=="posted");
  for(const row of pending){
    const net=Number(row.amount_net??row.amount_gross??0),vatAmount=Number(row.vat_amount??0);
    if(row.direction==="income"){revenue+=net;outputVat+=vatAmount}else{expenses+=net;inputVat+=vatAmount}
  }

  const profit=revenue-expenses;
  const vat=outputVat-inputVat;
  const reserve=Math.max(vat,0);
  const safe=bank-reserve;
  const reservePct=bank>0?clamp(Math.round((reserve/bank)*100),0,100):0;
  const readiness=rows.length?Math.round(((rows.length-pending.length)/rows.length)*100):100;
  const overdue=invoices.filter(invoice=>invoice.payment_status!=="paid"&&invoice.due_date&&new Date(`${invoice.due_date}T23:59:59`)<now);
  const attention=pending.length+overdue.length;
  const monthly=Array.from({length:12},()=>({income:0,expense:0}));
  for(const row of rows){
    const month=Number(row.occurred_on.slice(5,7))-1;
    if(month>=0&&month<12){const amount=Number(row.amount_gross);row.direction==="income"?monthly[month].income+=amount:monthly[month].expense+=amount}
  }

  const greeting=now.getHours()<12?"Good morning":now.getHours()<18?"Good afternoon":"Good evening";
  const recentRows=rows.slice(0,7);

  return <div className={styles.page}>
    <header className={styles.welcome}>
      <div>
        <p className={styles.eyebrow}>{now.toLocaleDateString("en-LU",{weekday:"long",day:"2-digit",month:"long"})}</p>
        <h1>{greeting}.</h1>
        <p>{attention?`${attention} ${attention===1?"item needs":"items need"} attention. `:"Everything important is under control. `}<span>{workspace.company.legal_name}</span></p>
      </div>
    </header>

    <section className={styles.topGrid}>
      <article className={styles.balanceCard}>
        <div className={styles.balanceTop}>
          <div><span className={styles.cardLabel}>Total book cash</span><small>Posted bank balance</small></div>
          <span className={styles.currencyPill}>{currency}</span>
        </div>
        <strong className={styles.balanceAmount}>{money(bank,currency)}</strong>
        <div className={styles.balanceSignal}><span className={bank>=0?styles.signalGood:styles.signalBad}>{bank>=0?"Available":"Overdrawn"}</span><small>Ledger account 5131</small></div>

        <div className={styles.quickActions}>
          <Link className={styles.primaryQuick} href="/app/transactions"><Plus size={14}/>Add activity</Link>
          <Link className={styles.secondaryQuick} href="/app/banking"><Upload size={14}/>Import bank CSV</Link>
        </div>

        <div className={styles.balanceBreakdown}>
          <div><span>Safe to use</span><strong className={safe>=0?styles.positiveText:styles.negativeText}>{money(safe,currency)}</strong><small>After known VAT reserve</small></div>
          <div><span>Tax reserve</span><strong>{money(reserve,currency)}</strong><small>{reservePct}% of book cash</small></div>
          <div><span>Receivables</span><strong>{money(receivables,currency)}</strong><small>Customer balance</small></div>
        </div>
      </article>

      <section className={styles.metricCluster} aria-label="Financial highlights">
        <article className={`${styles.metricTile} ${styles.metricAccent}`}>
          <div className={styles.metricHead}><span>Total revenue</span><WalletCards size={15}/></div>
          <strong>{money(revenue,currency)}</strong>
          <small>{year} year to date</small>
        </article>
        <article className={styles.metricTile}>
          <div className={styles.metricHead}><span>Total spending</span><ReceiptText size={15}/></div>
          <strong>{money(expenses,currency)}</strong>
          <small>{revenue?`${Math.round(expenses/revenue*100)}% of revenue`:"No ratio yet"}</small>
        </article>
        <article className={styles.metricTile}>
          <div className={styles.metricHead}><span>Estimated profit</span><ArrowUpRight size={15}/></div>
          <strong className={profit>=0?styles.positiveText:styles.negativeText}>{money(profit,currency)}</strong>
          <small>{pending.length?`${pending.length} provisional item${pending.length===1?"":"s"}`:"Fully posted"}</small>
        </article>
        <article className={styles.metricTile}>
          <div className={styles.metricHead}><span>VAT position</span><Landmark size={15}/></div>
          <strong>{money(vat,currency)}</strong>
          <small>{vat>0?"Payable to AED":vat<0?"VAT credit":"Balanced"}</small>
        </article>
      </section>

      <OverviewChart monthly={monthly} currency={currency} year={year} currentMonth={now.getMonth()}/>
    </section>

    <section className={styles.lowerGrid}>
      <div className={styles.leftRail}>
        <article className={styles.readinessCard}>
          <div className={styles.readinessHead}><div><span className={styles.cardLabel}>Bookkeeping readiness</span><h2>{readiness}% complete</h2></div><ShieldCheck size={18}/></div>
          <div className={styles.readinessTrack}><span style={{width:`${readiness}%`}}/></div>
          <div className={styles.readinessMeta}><span><b>{rows.length-pending.length}</b> posted</span><span><b>{pending.length}</b> to review</span></div>
        </article>

        <article className={styles.obligationsCard}>
          <div className={styles.obligationsHead}><div><span className={styles.cardLabel}>Compliance calendar</span><h2>Upcoming obligations</h2></div><Link href="/app/compliance">View all</Link></div>
          {obligations.length===0?<div className={styles.obligationClear}><CheckCircle2 size={16}/>No open obligations loaded.</div>:<div className={styles.obligationList}>{obligations.slice(0,3).map(obligation=><Link href="/app/compliance" className={styles.obligation} key={obligation.id}>
            <span className={styles.obligationIcon}><CalendarDays size={15}/></span>
            <span><strong>{title(obligation.obligation_type)}</strong><small>{obligation.authority} · {obligation.period_label??year}</small></span>
            <b>{obligation.due_date?new Date(`${obligation.due_date}T12:00:00`).toLocaleDateString("en-LU",{day:"2-digit",month:"short"}):"Open"}</b>
          </Link>)}</div>}
        </article>
      </div>

      <article className={styles.activityCard}>
        <div className={styles.activityHead}>
          <div><span className={styles.cardLabel}>Recent activity</span><h2>Latest transactions</h2></div>
          <div className={styles.activityTools}><span>{pending.length} need review</span><Link href="/app/transactions">View all</Link></div>
        </div>
        {recentRows.length===0?<div className={styles.activityEmpty}><ReceiptText size={20}/><strong>No activity yet</strong><span>Add a transaction or import a bank statement to get started.</span></div>:<div className={styles.activityTableWrap}><table className={styles.activityTable}>
          <thead><tr><th>Date</th><th>Transaction</th><th>Status</th><th>Amount</th></tr></thead>
          <tbody>{recentRows.map(row=>{const income=row.direction==="income",posted=row.classification_status==="posted";return <tr key={row.id}>
            <td>{new Date(`${row.occurred_on}T12:00:00`).toLocaleDateString("en-LU",{day:"2-digit",month:"short"})}</td>
            <td><Link href="/app/transactions"><strong>{row.counterparty_name||row.description||(income?"Income":"Expense")}</strong><small>{row.description&&row.counterparty_name?row.description:row.amount_net!==null?`Net ${money(Number(row.amount_net),row.currency)}`:"Recorded activity"}</small></Link></td>
            <td><span className={`${styles.activityStatus} ${posted?styles.statusPosted:styles.statusReview}`}><i/>{posted?"Posted":"Review"}</span></td>
            <td className={income?styles.incomeAmount:styles.expenseAmount}>{income?<ArrowUpRight size={12}/>:<ArrowDownLeft size={12}/>} {income?"+":"−"}{money(Number(row.amount_gross),row.currency)}</td>
          </tr>})}</tbody>
        </table></div>}
      </article>
    </section>

    <footer className={styles.footer}><span>Compta · Luxembourg-first accounting</span><span>Live ledger · {year}</span></footer>
  </div>;
}
