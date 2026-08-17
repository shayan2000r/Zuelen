import { ArrowDownLeft, ArrowRight, ArrowUpRight, Landmark, ReceiptText, Sparkles, WalletCards } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import styles from "./overview.module.css";

export const dynamic = "force-dynamic";
type LedgerLine={journal_entry_id:string;company_account_id:string;debit:number|string;credit:number|string};
type Account={id:string;code:string;account_type:string};
function money(value:number,currency:string){return new Intl.NumberFormat("en-LU",{style:"currency",currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(value)}
function irc(profit:number){if(profit<=0)return 0;if(profit<=175000)return profit*.14;if(profit<=200001)return 24500+(profit-175000)*.30;return profit*.16}
function shortMonth(index:number){return new Date(2026,index,1).toLocaleDateString("en-LU",{month:"short"}).slice(0,3)}

export default async function OverviewPage(){
 const workspace=await getWorkspace();if(!workspace.authenticated)redirect("/sign-in");if(!workspace.company)redirect("/setup");
 const now=new Date(),year=now.getFullYear(),currency=workspace.company.base_currency||"EUR",supabase=await createClient();
 const[entriesResult,accountsResult,transactionsResult,taxProfileResult]=await Promise.all([
  supabase.from("journal_entries").select("id,entry_date").eq("company_id",workspace.company.id).eq("status","posted").gte("entry_date",`${year}-01-01`).lte("entry_date",`${year}-12-31`),
  supabase.from("company_accounts").select("id,code,account_type").eq("company_id",workspace.company.id),
  supabase.from("source_transactions").select("id,occurred_on,direction,amount_gross,currency,counterparty_name,description,classification_status").eq("company_id",workspace.company.id).not("classification_status","in",'(reversed,ignored)').order("occurred_on",{ascending:false}).order("created_at",{ascending:false}).limit(8),
  supabase.from("company_tax_profiles").select("icc_multiplier").eq("company_id",workspace.company.id).maybeSingle(),
 ]);
 for(const result of[entriesResult,accountsResult,transactionsResult,taxProfileResult])if(result.error)throw new Error(result.error.message);
 const entries=entriesResult.data??[],accounts=(accountsResult.data??[]) as Account[],accountMap=new Map(accounts.map(a=>[a.id,a])),dateMap=new Map(entries.map(e=>[e.id,e.entry_date])),monthly=Array.from({length:12},()=>({revenue:0,expense:0}));
 let lines:LedgerLine[]=[];if(entries.length){const r=await supabase.from("journal_lines").select("journal_entry_id,company_account_id,debit,credit").in("journal_entry_id",entries.map(e=>e.id));if(r.error)throw new Error(r.error.message);lines=(r.data??[]) as LedgerLine[]}
 let revenue=0,expenses=0,outputVat=0,inputVat=0;for(const line of lines){const a=accountMap.get(line.company_account_id);if(!a)continue;const d=Number(line.debit),c=Number(line.credit),date=dateMap.get(line.journal_entry_id),month=date?Number(date.slice(5,7))-1:-1;if(a.account_type==="revenue"){const v=c-d;revenue+=v;if(month>=0)monthly[month].revenue+=v}if(a.account_type==="expense"&&!['6711','6721','6811'].includes(a.code)){const v=d-c;expenses+=v;if(month>=0)monthly[month].expense+=v}if(a.code==="461411")outputVat+=c-d;if(a.code==="421611")inputVat+=d-c}
 const profit=revenue-expenses,vat=outputVat-inputVat,profitForTax=Math.max(0,profit),ircTax=irc(profitForTax),fund=ircTax*.07,multiplier=taxProfileResult.data?.icc_multiplier==null?null:Number(taxProfileResult.data.icc_multiplier),icc=multiplier===null?0:Math.max(profitForTax-17500,0)*.03*multiplier,estimatedTaxes=ircTax+fund+icc;
 const greeting=now.getHours()<12?"Good morning":now.getHours()<18?"Good afternoon":"Good evening",name=workspace.company.trading_name||workspace.company.legal_name,chartMax=Math.max(1,...monthly.flatMap(m=>[m.revenue,m.expense])),recent=transactionsResult.data??[];
 return <div className={styles.page}>
  <header className={styles.hero}><div><p>{now.toLocaleDateString("en-LU",{weekday:"long",day:"2-digit",month:"long"})}</p><h1>{greeting}, <span>{name}</span>.</h1><h2>Stay on top of your finances, monitor performance, and track what matters.</h2></div><Link href="/app/reports">View reports <ArrowRight size={14}/></Link></header>

  <section className={styles.metricGrid}>
   <Link href="/app/reports" className={styles.metricCard}><span className={styles.metricIcon}><WalletCards size={17}/></span><div><small>Revenue</small><strong>{money(revenue,currency)}</strong><p>Posted · {year} YTD</p></div><ArrowUpRight className={styles.metricArrow} size={16}/></Link>
   <Link href="/app/transactions?status=posted" className={styles.metricCard}><span className={styles.metricIcon}><ReceiptText size={17}/></span><div><small>Expenses</small><strong>{money(expenses,currency)}</strong><p>Operating spend · YTD</p></div><ArrowUpRight className={styles.metricArrow} size={16}/></Link>
   <Link href="/app/vat" className={styles.metricCard}><span className={styles.metricIcon}><Landmark size={17}/></span><div><small>VAT position</small><strong>{money(Math.abs(vat),currency)}</strong><p>{vat>0?"Currently payable":vat<0?"Current VAT credit":"Balanced"}</p></div><ArrowUpRight className={styles.metricArrow} size={16}/></Link>
   <Link href="/app/tax-reserve" className={styles.metricCard}><span className={styles.metricIcon}><Sparkles size={17}/></span><div><small>Estimated taxes</small><strong>{money(estimatedTaxes,currency)}</strong><p>{multiplier===null?"ICC not included yet":"IRC + fund + ICC estimate"}</p></div><ArrowUpRight className={styles.metricArrow} size={16}/></Link>
  </section>

  <section className={styles.mainGrid}>
   <article className={styles.overviewCard}>
    <div className={styles.cardHead}><div><p>Overview</p><h2>Revenue & expenses</h2></div><div className={styles.legend}><span><i className={styles.revenueDot}/>Revenue</span><span><i className={styles.expenseDot}/>Expenses</span></div></div>
    <div className={styles.chartSummary}><div><span>Net result</span><strong className={profit>=0?styles.positive:styles.negative}>{money(profit,currency)}</strong></div><div><span>Margin</span><strong>{revenue?`${Math.round((profit/revenue)*100)}%`:"—"}</strong></div></div>
    <div className={styles.barChart}>{monthly.map((month,index)=><div className={styles.barGroup} key={index}><div className={styles.bars}><span className={styles.revenueBar} style={{height:`${Math.max(month.revenue?4:0,(month.revenue/chartMax)*100)}%`}}/><span className={styles.expenseBar} style={{height:`${Math.max(month.expense?4:0,(month.expense/chartMax)*100)}%`}}/></div><small>{shortMonth(index)}</small></div>)}</div>
   </article>

   <article className={styles.aiCard}>
    <div className={styles.aiTop}><div><p>Compta Copilot</p><h2>Your books, explained simply.</h2></div><span><Sparkles size={18}/></span></div>
    <div className={styles.aiIllustration} aria-hidden="true"><div className={styles.aiTileOne}><span>€</span><b>{Math.max(0,Math.round(profit/1000))}k</b></div><div className={styles.aiOrb}><Sparkles size={23}/></div><div className={styles.aiTileTwo}><i/><i/><i/></div><div className={styles.aiGridDots}/></div>
    <p>Ask about VAT, cash, tax reserve, invoices or what is blocking year-end. Answers are grounded in your Compta records.</p>
    <div className={styles.aiPrompts}><Link href="/app/copilot?prompt=How much VAT do I owe?">VAT position</Link><Link href="/app/copilot?prompt=How much cash can I safely use?">Safe cash</Link></div>
    <Link href="/app/copilot" className={styles.aiAction}>Open Copilot <ArrowRight size={14}/></Link>
   </article>
  </section>

  <article className={styles.activityCard}>
   <div className={styles.cardHead}><div><p>Recent activity</p><h2>Latest transactions</h2></div><Link href="/app/transactions">View all <ArrowRight size={13}/></Link></div>
   {recent.length===0?<div className={styles.empty}>No transactions yet. Add your first transaction or import a bank statement.</div>:<div className={styles.activityList}>{recent.map(row=>{const income=row.direction==="income";return <div className={styles.activityRow} key={row.id}><span className={`${styles.activityIcon} ${income?styles.incomeIcon:""}`}>{income?<ArrowDownLeft size={15}/>:<ArrowUpRight size={15}/>}</span><div><strong>{row.counterparty_name||row.description||(income?"Income":"Expense")}</strong><small>{new Date(`${row.occurred_on}T12:00:00`).toLocaleDateString("en-LU",{day:"2-digit",month:"short"})} · {row.classification_status==="posted"?"Posted":"Needs review"}</small></div><b className={income?styles.incomeAmount:""}>{income?"+":"−"}{money(Number(row.amount_gross),row.currency)}</b></div>})}</div>}
  </article>
 </div>;
}
