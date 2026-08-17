import { AlertTriangle, CheckCircle2, CircleDashed, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "@/components/year-end.module.css";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
export const dynamic="force-dynamic";
function money(v:number,c:string){return new Intl.NumberFormat("en-LU",{style:"currency",currency:c,minimumFractionDigits:2}).format(v)}
export default async function YearEndPage(){const w=await getWorkspace();if(!w.authenticated)redirect("/sign-in");if(!w.company)redirect("/setup");const s=await createClient(),year=new Date().getFullYear(),currency=w.company.base_currency||"EUR",from=`${year}-01-01`,to=`${year}-12-31`;
 const [pending,bank,drafts,unpaid,docs,vat,entries,shareAccounts]=await Promise.all([
  s.from("source_transactions").select("id",{count:"exact",head:true}).eq("company_id",w.company.id).in("classification_status",["unclassified","review","classified"]).gte("occurred_on",from).lte("occurred_on",to),
  s.from("bank_transactions").select("id",{count:"exact",head:true}).eq("company_id",w.company.id).neq("match_status","matched").gte("booking_date",from).lte("booking_date",to),
  s.from("sales_invoices").select("id",{count:"exact",head:true}).eq("company_id",w.company.id).eq("status","draft"),
  s.from("sales_invoices").select("id,total,payment_status").eq("company_id",w.company.id).eq("status","issued").neq("payment_status","paid"),
  s.from("documents").select("id",{count:"exact",head:true}).eq("company_id",w.company.id).in("extraction_status",["failed","needs_review","processing"]),
  s.from("source_transactions").select("id",{count:"exact",head:true}).eq("company_id",w.company.id).neq("classification_status","posted").gt("vat_amount",0).gte("occurred_on",from).lte("occurred_on",to),
  s.from("journal_entries").select("id").eq("company_id",w.company.id).eq("status","posted").gte("entry_date",from).lte("entry_date",to),
  s.from("company_accounts").select("id,code,label").eq("company_id",w.company.id).in("code",["4212","4712"])
 ]);
 const entryIds=entries.data?.map(e=>e.id)??[],shareIds=shareAccounts.data?.map(a=>a.id)??[];let imbalance=0,shareBalance=0;if(entryIds.length){const {data:lines}=await s.from("journal_lines").select("journal_entry_id,company_account_id,debit,credit").in("journal_entry_id",entryIds);const sums=new Map<string,{d:number;c:number}>();for(const l of lines??[]){const x=sums.get(l.journal_entry_id)??{d:0,c:0};x.d+=Number(l.debit);x.c+=Number(l.credit);sums.set(l.journal_entry_id,x);if(shareIds.includes(l.company_account_id))shareBalance+=Number(l.credit)-Number(l.debit)}imbalance=[...sums.values()].filter(x=>Math.abs(x.d-x.c)>.005).length}
 const outstanding=(unpaid.data??[]).reduce((sum,i)=>sum+Number(i.total),0),checks=[
  {label:"Transactions reviewed",value:pending.count??0,ok:(pending.count??0)===0,href:"/app/transactions",detail:`${pending.count??0} still need classification`},
  {label:"Bank reconciliation",value:bank.count??0,ok:(bank.count??0)===0,href:"/app/banking",detail:`${bank.count??0} bank movements remain unmatched`},
  {label:"Draft invoices",value:drafts.count??0,ok:(drafts.count??0)===0,href:"/app/invoices",detail:`${drafts.count??0} drafts remain outside the ledger`},
  {label:"VAT review",value:vat.count??0,ok:(vat.count??0)===0,href:"/app/taxes",detail:`${vat.count??0} VAT-bearing items are unresolved`},
  {label:"Document review",value:docs.count??0,ok:(docs.count??0)===0,href:"/app/documents",detail:`${docs.count??0} documents need extraction/review`},
  {label:"Ledger integrity",value:imbalance,ok:imbalance===0,href:"/app/accounting",detail:imbalance?`${imbalance} posted entries are not balanced`:"Every posted entry balances"}
 ];const ready=checks.every(c=>c.ok);
 return <div className={styles.page}><div className={styles.intro}><div><p>Year-end · {year}</p><h1>{ready?"The books are structurally ready.":"Close the gaps before you close the year."}</h1><span>Compta checks the operational evidence first. Formal closing and eCDF generation stay locked until the books are ready.</span></div><div className={`${styles.ready} ${ready?styles.readyGood:""}`}>{ready?<CheckCircle2/>:<CircleDashed/>}{ready?"Ready for closing review":"Closing blockers remain"}</div></div>
 <section className={styles.checks}>{checks.map(c=><Link href={c.href} className={styles.check} key={c.label}><span className={c.ok?styles.ok:styles.warn}>{c.ok?<CheckCircle2/>:<AlertTriangle/>}</span><div><strong>{c.label}</strong><small>{c.detail}</small></div><b>{c.ok?"Clear":c.value}</b></Link>)}</section>
 <section className={styles.grid}><article><p>Receivables</p><h2>{money(outstanding,currency)}</h2><span>{unpaid.data?.length??0} issued invoices are not fully settled. Outstanding receivables do not necessarily block closing, but they must be reviewed and carried correctly.</span></article><article><p>Shareholder current account</p><h2>{money(Math.abs(shareBalance),currency)}</h2><span>{shareBalance>0?"Company currently owes the shareholder based on 4712/4212 movements.":shareBalance<0?"Shareholder currently owes the company based on 4712/4212 movements.":"No net shareholder current-account balance detected."}</span></article><article><p>Posted journal</p><h2>{entryIds.length}</h2><span>Entries included in the {year} year-end integrity review.</span></article></section>
 <article className={styles.lock}><LockKeyhole/><div><strong>Formal close remains protected</strong><p>The next layer will create a closing snapshot, lock the period, freeze the trial balance and feed annual-account/eCDF preparation. Compta will not hard-close a year while blockers remain.</p></div></article></div>}
