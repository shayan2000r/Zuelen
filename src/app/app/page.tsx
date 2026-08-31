import { ArrowDownLeft, ArrowRight, ArrowUpRight, HeartHandshake, Landmark, Plus, ReceiptText, Sparkles, WalletCards } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { fiscalYearBounds, getActiveFiscalYear } from "@/lib/fiscal-year";
import { intlLocale, normalizeLocale, t, type Locale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { MetricCard, MetricGrid, PageHeader, Panel, SectionHeader, V2Button, V2Page, V2TwoColumn } from "@/components/zuelen-ui-v2";
import styles from "./overview.module.css";

export const dynamic = "force-dynamic";
type LedgerLine={journal_entry_id:string;company_account_id:string;debit:number|string;credit:number|string};
type Account={id:string;code:string;account_type:string};
function money(value:number,currency:string,locale:Locale){return new Intl.NumberFormat(intlLocale(locale),{style:"currency",currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(value)}
function irc(profit:number){if(profit<=0)return 0;if(profit<=175000)return profit*.14;if(profit<=200001)return 24500+(profit-175000)*.30;return profit*.16}

export default async function OverviewPage(){
 const workspace=await getWorkspace();if(!workspace.authenticated)redirect("/sign-in");if(!workspace.company)redirect("/setup");
 const locale=normalizeLocale(workspace.profile?.locale),fr=locale==="fr",independent=workspace.company.entity_kind==="independent",dateLocale=intlLocale(locale),now=new Date(),year=await getActiveFiscalYear(workspace.company.fiscal_year_start_month),bounds=fiscalYearBounds(year,workspace.company.fiscal_year_start_month),currency=workspace.company.base_currency||"EUR",supabase=await createClient();
 const monthKeys=Array.from({length:12},(_,index)=>{const d=new Date(Date.UTC(year,workspace.company!.fiscal_year_start_month-1+index,1));return{key:d.toISOString().slice(0,7),label:d.toLocaleDateString(dateLocale,{month:"short",timeZone:"UTC"}).replace(".","").slice(0,3)}}),monthIndex=new Map(monthKeys.map((month,index)=>[month.key,index]));
 const[entriesResult,accountsResult,transactionsResult,taxProfileResult]=await Promise.all([
  supabase.from("journal_entries").select("id,entry_date").eq("company_id",workspace.company.id).eq("status","posted").gte("entry_date",bounds.start).lte("entry_date",bounds.end),
  supabase.from("company_accounts").select("id,code,account_type").eq("company_id",workspace.company.id),
  supabase.from("source_transactions").select("id,occurred_on,direction,amount_gross,currency,counterparty_name,description,classification_status").eq("company_id",workspace.company.id).not("classification_status","in",'(reversed,ignored)').gte("occurred_on",bounds.start).lte("occurred_on",bounds.end).order("occurred_on",{ascending:false}).order("created_at",{ascending:false}).limit(8),
  independent?Promise.resolve({data:null,error:null}):supabase.from("company_tax_profiles").select("icc_multiplier,icc_multiplier_year").eq("company_id",workspace.company.id).maybeSingle(),
 ]);
 for(const result of[entriesResult,accountsResult,transactionsResult,taxProfileResult])if(result.error)throw new Error(result.error.message);
 const entries=entriesResult.data??[],accounts=(accountsResult.data??[]) as Account[],accountMap=new Map(accounts.map(a=>[a.id,a])),dateMap=new Map(entries.map(e=>[e.id,e.entry_date])),monthly=Array.from({length:12},()=>({revenue:0,expense:0}));
 let lines:LedgerLine[]=[];if(entries.length){const r=await supabase.from("journal_lines").select("journal_entry_id,company_account_id,debit,credit").in("journal_entry_id",entries.map(e=>e.id));if(r.error)throw new Error(r.error.message);lines=(r.data??[]) as LedgerLine[]}
 let revenue=0,expenses=0,outputVat=0,inputVat=0;for(const line of lines){const a=accountMap.get(line.company_account_id);if(!a)continue;const d=Number(line.debit),c=Number(line.credit),date=dateMap.get(line.journal_entry_id),index=date?monthIndex.get(date.slice(0,7)):-1;if(a.account_type==="revenue"){const v=c-d;revenue+=v;if(index!==undefined&&index>=0)monthly[index].revenue+=v}if(a.account_type==="expense"&&!['6711','6721','6811'].includes(a.code)){const v=d-c;expenses+=v;if(index!==undefined&&index>=0)monthly[index].expense+=v}if(a.code==="461411")outputVat+=c-d;if(a.code==="421611")inputVat+=d-c}
 const profit=revenue-expenses,vat=outputVat-inputVat,profitForTax=Math.max(0,profit),ircTax=independent?0:irc(profitForTax),fund=ircTax*.07,profileYear=Number(taxProfileResult.data?.icc_multiplier_year),multiplier=profileYear===year&&taxProfileResult.data?.icc_multiplier!=null?Number(taxProfileResult.data.icc_multiplier):null,icc=independent||multiplier===null?0:Math.max(profitForTax-17500,0)*.03*multiplier,estimatedTaxes=ircTax+fund+icc;
 const hour=now.getHours(),greeting=fr?(hour<18?"Bonjour":"Bonsoir"):(hour<12?"Good morning":hour<18?"Good afternoon":"Good evening"),name=workspace.company.trading_name||workspace.company.legal_name,chartMax=Math.max(1,...monthly.flatMap(m=>[m.revenue,m.expense])),recent=transactionsResult.data??[],margin=revenue?(profit/revenue)*100:0;
 const vatDescription=vat>0?(fr?"TVA estimée à payer":"Estimated VAT payable"):vat<0?(fr?"TVA estimée à récupérer":"Estimated VAT recoverable"):(fr?"Position TVA équilibrée":"VAT position balanced");
 return <V2Page>
  <PageHeader eyebrow={`${t(locale,"financialYear")} ${year} · ${bounds.start} → ${bounds.end}`} title={<>{greeting}, {name}.</>} description={independent?(fr?"Votre chiffre d’affaires, vos charges, votre bénéfice professionnel et vos prochaines obligations dans une vue claire.":"Your income, expenses, professional profit and next obligations in one clear view."):(fr?"Vos chiffres essentiels, vos tendances et vos prochaines actions dans une vue financière claire.":"Your essential numbers, financial picture and next actions in one clear workspace.")} actions={[{label:fr?"Ajouter une transaction":"Add transaction",href:"/app/transactions?create=1",icon:Plus,variant:"primary"},{label:t(locale,"viewReports"),href:"/app/reports",icon:ArrowRight,variant:"secondary"}]}/>

  <MetricGrid>
   <MetricCard label={t(locale,"revenue")} value={money(revenue,currency,locale)} description={fr?"Revenus comptabilisés sur l’exercice sélectionné.":"Posted revenue for the selected financial year."} icon={WalletCards} href="/app/reports"/>
   <MetricCard label={t(locale,"expenses")} value={money(expenses,currency,locale)} description={fr?"Charges d’exploitation comptabilisées sur l’exercice.":"Operating expenses posted for the financial year."} icon={ReceiptText} href="/app/transactions?status=posted"/>
   <MetricCard label={independent?(fr?"Bénéfice professionnel":"Professional profit"):t(locale,"netResult")} value={money(profit,currency,locale)} description={profit>=0?(independent?(fr?"Revenus moins charges comptabilisées. Aucun impôt personnel n’est estimé ici.":"Posted income less expenses. No personal income tax is estimated here."):(fr?"Résultat positif avant impôts estimés.":"Positive result before estimated taxes.")):(fr?"Les charges dépassent actuellement les revenus.":"Expenses currently exceed revenue.")} icon={Sparkles} href="/app/reports"/>
   {workspace.capabilities?.hasVat?<MetricCard label={t(locale,"vatPosition")} value={money(Math.abs(vat),currency,locale)} description={vatDescription} icon={Landmark} href="/app/vat"/>:<MetricCard label="CCSS" value={fr?"Estimation personnelle":"Personal estimate"} description={fr?"Planifiez les cotisations à mettre de côté.":"Plan the social-security contributions to set aside."} icon={HeartHandshake} href="/app/ccss"/>}
  </MetricGrid>

  <div style={{height:"var(--z-space-7)"}}/>
  <V2TwoColumn>
   <Panel>
    <SectionHeader eyebrow={t(locale,"overview")} title={t(locale,"revenueExpenses")} description={fr?"Évolution mensuelle des revenus et charges comptabilisés.":"Monthly movement of posted revenue and expenses."} action={<div className={styles.legend}><span><i className={styles.revenueDot}/>{t(locale,"revenue")}</span><span><i className={styles.expenseDot}/>{t(locale,"expenses")}</span></div>}/>
    <div className={styles.chartSummary}><div><span>{independent?(fr?"Planification CCSS":"CCSS planning"):t(locale,"estimatedTaxes")}</span><strong>{independent?(fr?"Ouvrir CCSS":"Open CCSS"):money(estimatedTaxes,currency,locale)}</strong></div><div><span>{t(locale,"margin")}</span><strong className={margin>=0?styles.positive:styles.negative}>{revenue?`${Math.round(margin)}%`:"—"}</strong></div></div>
    <div className={styles.barChart}>{monthly.map((month,index)=><div className={styles.barGroup} key={monthKeys[index].key}><div className={styles.bars}><span className={styles.revenueBar} style={{height:`${Math.max(month.revenue?4:0,(month.revenue/chartMax)*100)}%`}}/><span className={styles.expenseBar} style={{height:`${Math.max(month.expense?4:0,(month.expense/chartMax)*100)}%`}}/></div><small>{monthKeys[index].label}</small></div>)}</div>
   </Panel>

   <article className={styles.aiCard}>
    <div className={styles.aiTop}><div><p>Zuelen Copilot</p><h2>{t(locale,"yourBooksExplained")}</h2></div><span><Sparkles size={18}/></span></div>
    <div className={styles.aiIllustration} aria-hidden="true">
      <div className={styles.aiPrompt}><Sparkles size={12}/><span>{fr?"Que dois-je surveiller ?":"What should I watch?"}</span></div>
      <div className={styles.aiResponse}><span><Image src="/zuelen-icon.png" alt="" width={31} height={31}/></span><div><b>{fr?"Votre situation est à jour.":"Your position is up to date."}</b><i/><i/><i/></div></div>
      <div className={styles.aiTileOne}><span>{fr?"Résultat":"Result"}</span><b>{money(profit,currency,locale)}</b></div>
      <div className={styles.aiOrb}><Image src="/zuelen-icon.png" alt="" width={42} height={42}/><Sparkles size={14}/></div>
      <div className={styles.aiTileTwo}><i/><i/><i/></div><div className={styles.aiGridDots}/>
    </div>
    <p>{fr?"Posez une question sur la TVA, la trésorerie, les impôts, les factures ou la clôture. Zuelen utilise le contexte de votre exercice sélectionné.":"Ask about VAT, cash, taxes, invoices or year-end. Zuelen uses the context of your selected financial year."}</p>
    <Link href="/app/copilot" className={styles.aiAction}>{t(locale,"openCopilot")} <ArrowRight size={14}/></Link>
   </article>
  </V2TwoColumn>

  <div style={{height:"var(--z-space-7)"}}/>
  <Panel>
   <SectionHeader eyebrow={t(locale,"recentActivity")} title={t(locale,"latestTransactions")} description={fr?"Les mouvements les plus récents de l’exercice sélectionné.":"The latest activity in the selected financial year."} action={<V2Button label={t(locale,"viewAll")} href="/app/transactions" icon={ArrowRight} variant="ghost"/>}/>
   {recent.length===0?<div className={styles.empty}>{t(locale,"noTransactions")}</div>:<div className={styles.activityList}>{recent.map(row=>{const income=row.direction==="income";return <div className={styles.activityRow} key={row.id}><span className={`${styles.activityIcon} ${income?styles.incomeIcon:""}`}>{income?<ArrowDownLeft size={15}/>:<ArrowUpRight size={15}/>}</span><div><strong>{row.counterparty_name||row.description||(income?t(locale,"income"):t(locale,"expense"))}</strong><small>{new Date(`${row.occurred_on}T12:00:00`).toLocaleDateString(dateLocale,{day:"2-digit",month:"short"})} · {row.classification_status==="posted"?t(locale,"posted"):t(locale,"needsReview")}</small></div><b className={income?styles.incomeAmount:""}>{income?"+":"−"}{money(Number(row.amount_gross),row.currency,locale)}</b></div>})}</div>}
  </Panel>
 </V2Page>;
}
