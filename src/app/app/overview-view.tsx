import { ArrowRight, ArrowUpRight, CalendarDays, HeartHandshake, Landmark, Plus, ReceiptText, Sparkles, TrendingUp, WalletCards } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { intlLocale, t, type Locale } from "@/lib/i18n";
import { V2Page } from "@/components/zuelen-ui-v2";
import styles from "./overview.module.css";

export type OverviewMonth={key:string;label:string;long:string;revenue:number;expense:number};
export type OverviewTransaction={id:string;occurred_on:string;direction:string;amount_gross:number|string;currency:string;counterparty_name:string|null;description:string|null;classification_status:string};
export type OverviewData={
 locale:Locale;independent:boolean;hasVat:boolean;greeting:string;name:string;currency:string;
 year:number;bounds:{start:string;end:string};currentMonthKey:string;months:OverviewMonth[];
 revenue:number;expenses:number;vat:number;ircTax:number;fund:number;icc:number;iccRateMissing:boolean;
 recent:OverviewTransaction[];
};

function money(value:number,currency:string,locale:Locale){return new Intl.NumberFormat(intlLocale(locale),{style:"currency",currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(value)}

/** Renders an amount with the whole units emphasised and the currency and cents quieter. */
function Money({value,currency,locale,className}:{value:number;currency:string;locale:Locale;className?:string}){
 const parts=new Intl.NumberFormat(intlLocale(locale),{style:"currency",currency,minimumFractionDigits:2,maximumFractionDigits:2}).formatToParts(value);
 return <span className={`${styles.money} ${className??""}`} aria-label={money(value,currency,locale)}>{parts.map((part,index)=>["decimal","fraction","currency"].includes(part.type)?<span key={index} className={styles.minor}>{part.value}</span>:part.type==="literal"&&/\s/.test(part.value)?<span key={index} className={styles.minor}>{" "}</span>:<span key={index}>{part.value}</span>)}</span>;
}

/** Rounds a chart maximum up to a readable axis step so the tallest bar fills most of the plot. */
function niceStep(max:number,ticks:number){const raw=max/ticks,magnitude=10**Math.floor(Math.log10(raw)),step=[1,2,2.5,5,10].find(m=>m*magnitude>=raw)??10;return step*magnitude}

function Sparkline({values,tone}:{values:number[];tone:"brand"|"ink"|"light"}){
 if(values.length<2||values.every(v=>v===0))return <svg className={styles.sparkline} viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="30" x2="120" y2="30" className={styles[`spark_${tone}`]} strokeDasharray="3 4" vectorEffect="non-scaling-stroke"/></svg>;
 const min=Math.min(0,...values),max=Math.max(...values),range=max-min||1,points=values.map((v,i)=>[(i/(values.length-1))*120,32-((v-min)/range)*28]);
 // Catmull-Rom → cubic Bézier keeps the trend line smooth without overshooting much.
 const line=points.map(([x,y],i)=>{if(!i)return`M${x.toFixed(1)},${y.toFixed(1)}`;const[p0,p1,p2,p3]=[points[i-2]??points[i-1],points[i-1],points[i],points[i+1]??points[i]];const c1=[p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6],c2=[p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6];return`C${c1.map(n=>n.toFixed(1)).join(",")} ${c2.map(n=>n.toFixed(1)).join(",")} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`}).join(" ");
 return <svg className={styles.sparkline} viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true"><path d={`${line} L120,36 L0,36 Z`} className={styles[`sparkFill_${tone}`]}/><path d={line} className={styles[`spark_${tone}`]} vectorEffect="non-scaling-stroke"/></svg>;
}

export function OverviewView({data}:{data:OverviewData}){
 const{locale,independent,hasVat,greeting,name,currency,year,bounds,currentMonthKey:currentKey,revenue,expenses,vat,ircTax,fund,icc,iccRateMissing,recent}=data,fr=locale==="fr",dateLocale=intlLocale(locale);
 const monthKeys=data.months,monthly=data.months,profit=revenue-expenses,estimatedTaxes=ircTax+fund+icc,margin=revenue?(profit/revenue)*100:0;
 const vatDescription=vat>0?(fr?"TVA estimée à payer":"Estimated VAT payable"):vat<0?(fr?"TVA estimée à récupérer":"Estimated VAT recoverable"):(fr?"Position TVA équilibrée":"VAT position balanced");

 // Chart geometry and derived series. Months after today are left out of trend lines.
 const elapsed=Math.max(1,monthKeys.filter(m=>m.key<=currentKey).length),series=monthly.slice(0,elapsed);
 const chartPeak=Math.max(0,...monthly.flatMap(m=>[m.revenue,m.expense])),step=chartPeak>0?niceStep(chartPeak,5):1,axisMax=step*5,ticks=[5,4,3,2,1,0].map(i=>i*step);
 const compact=new Intl.NumberFormat(dateLocale,{notation:"compact",maximumFractionDigits:1});
 const bestIndex=monthly.reduce((best,m,i)=>m.revenue>monthly[best].revenue?i:best,0),hasActivity=chartPeak>0;
 const cumulativeProfit=series.reduce<number[]>((acc,m)=>[...acc,(acc.at(-1)??0)+m.revenue-m.expense],[]);
 const period=`${new Date(`${bounds.start}T12:00:00`).toLocaleDateString(dateLocale,{day:"numeric",month:"short"})} – ${new Date(`${bounds.end}T12:00:00`).toLocaleDateString(dateLocale,{day:"numeric",month:"short",year:"numeric"})}`;
 const taxParts=[{key:"irc",label:fr?"Impôt sur le revenu des collectivités":"Corporate income tax",short:"IRC",value:ircTax},{key:"fund",label:fr?"Contribution au fonds pour l’emploi":"Employment fund surcharge",short:fr?"Fonds emploi":"Employment fund",value:fund},{key:"icc",label:fr?"Impôt commercial communal":"Municipal business tax",short:"ICC",value:icc}];
 const copilotPrompts=fr?["Que dois-je surveiller ce mois-ci\u00a0?","Combien dois-je mettre de côté pour les impôts\u00a0?","Pourquoi mes charges ont-elles évolué\u00a0?"]:["What should I watch this month?","How much should I set aside for taxes?","Why did my expenses change?"];
 const reveal=(index:number)=>({"--d":`${index*60}ms`}) as CSSProperties;

 return <V2Page className={styles.page}>
  <header className={styles.header} style={reveal(0)}>
   <div className={styles.headerCopy}>
    <span className={styles.periodPill}><CalendarDays size={13}/>{t(locale,"financialYear")} {year}<i/>{period}</span>
    <h1>{greeting}, <span>{name}</span></h1>
    <p>{independent?(fr?"Votre chiffre d’affaires, vos charges, votre bénéfice professionnel et vos prochaines obligations dans une vue claire.":"Your income, expenses, professional profit and next obligations in one clear view."):(fr?"Vos chiffres essentiels, vos tendances et vos prochaines actions dans une vue financière claire.":"Your essential numbers, financial picture and next actions in one clear workspace.")}</p>
   </div>
   <div className={styles.headerActions}>
    <Link href="/app/reports" className={styles.btnGhost}>{t(locale,"viewReports")}<ArrowRight size={15}/></Link>
    <Link href="/app/transactions?create=1" className={styles.btnSolid}><Plus size={16}/>{fr?"Ajouter une transaction":"Add transaction"}</Link>
   </div>
  </header>

  <section className={styles.kpis} aria-label={fr?"Indicateurs clés":"Key figures"}>
   <Link href="/app/reports" className={`${styles.kpi} ${styles.kpiFeatured}`} style={reveal(1)}>
    <div className={styles.kpiTop}><span>{independent?(fr?"Bénéfice professionnel":"Professional profit"):t(locale,"netResult")}</span><i><TrendingUp size={16}/></i></div>
    <Money value={profit} currency={currency} locale={locale} className={styles.kpiValue}/>
    <div className={styles.kpiFoot}><b className={styles.pillOnDark}>{revenue?`${Math.round(margin)}% ${fr?"de marge":"margin"}`:"—"}</b><span>{profit>=0?(independent?(fr?"Revenus moins charges":"Income less expenses"):(fr?"Avant impôts estimés":"Before estimated taxes")):(fr?"Les charges dépassent les revenus":"Expenses exceed revenue")}</span></div>
    <Sparkline values={cumulativeProfit} tone="light"/>
   </Link>
   <Link href="/app/reports" className={styles.kpi} style={reveal(2)}>
    <div className={styles.kpiTop}><span>{t(locale,"revenue")}</span><i><WalletCards size={16}/></i></div>
    <Money value={revenue} currency={currency} locale={locale} className={styles.kpiValue}/>
    <div className={styles.kpiFoot}><span>{fr?"Comptabilisé sur l’exercice":"Posted this financial year"}</span></div>
    <Sparkline values={series.map(m=>m.revenue)} tone="brand"/>
   </Link>
   <Link href="/app/transactions?status=posted" className={styles.kpi} style={reveal(3)}>
    <div className={styles.kpiTop}><span>{t(locale,"expenses")}</span><i><ReceiptText size={16}/></i></div>
    <Money value={expenses} currency={currency} locale={locale} className={styles.kpiValue}/>
    <div className={styles.kpiFoot}><span>{fr?"Charges d’exploitation":"Operating expenses"}</span></div>
    <Sparkline values={series.map(m=>m.expense)} tone="ink"/>
   </Link>
   {hasVat
    ?<Link href="/app/vat" className={styles.kpi} style={reveal(4)}>
     <div className={styles.kpiTop}><span>{t(locale,"vatPosition")}</span><i><Landmark size={16}/></i></div>
     <Money value={Math.abs(vat)} currency={currency} locale={locale} className={styles.kpiValue}/>
     <div className={styles.kpiFoot}><b className={vat>0?styles.pillAmber:vat<0?styles.pillGreen:styles.pillMuted}>{vat>0?(fr?"À payer":"Payable"):vat<0?(fr?"À récupérer":"Recoverable"):(fr?"Équilibrée":"Balanced")}</b><span>{vatDescription}</span></div>
     <span className={styles.kpiLink}>{fr?"Ouvrir la TVA":"Open VAT"}<ArrowRight size={14}/></span>
    </Link>
    :<Link href="/app/ccss" className={styles.kpi} style={reveal(4)}>
     <div className={styles.kpiTop}><span>CCSS</span><i><HeartHandshake size={16}/></i></div>
     <strong className={`${styles.kpiValue} ${styles.kpiValueText}`}>{fr?"Estimation personnelle":"Personal estimate"}</strong>
     <div className={styles.kpiFoot}><span>{fr?"Planifiez les cotisations à mettre de côté.":"Plan the social-security contributions to set aside."}</span></div>
     <span className={styles.kpiLink}>{fr?"Ouvrir CCSS":"Open CCSS"}<ArrowRight size={14}/></span>
    </Link>}
  </section>

  <section className={styles.mainRow}>
   <article className={`${styles.tile} ${styles.chartTile}`} style={reveal(5)}>
    <div className={styles.tileHead}>
     <div><h2>{t(locale,"revenueExpenses")}</h2><p>{fr?"Montants comptabilisés par mois":"Posted amounts by month"} · {year}</p></div>
     <div className={styles.legend}><span><i className={styles.legendRevenue}/>{t(locale,"revenue")}</span><span><i className={styles.legendExpense}/>{t(locale,"expenses")}</span></div>
    </div>
    <dl className={styles.chartStats}>
     <div><dt>{independent?(fr?"Planification CCSS":"CCSS planning"):t(locale,"estimatedTaxes")}</dt><dd>{independent?<Link href="/app/ccss">{fr?"Ouvrir CCSS":"Open CCSS"} <ArrowUpRight size={14}/></Link>:<Money value={estimatedTaxes} currency={currency} locale={locale}/>}</dd></div>
     <div><dt>{t(locale,"margin")}</dt><dd className={margin>=0?styles.positive:styles.negative}>{revenue?`${Math.round(margin)}%`:"—"}</dd></div>
     <div><dt>{fr?"Meilleur mois":"Best month"}</dt><dd>{hasActivity&&monthly[bestIndex].revenue>0?<>{monthKeys[bestIndex].long.replace(/^\w/,c=>c.toUpperCase())}</>:"—"}</dd></div>
    </dl>
    <div className={styles.chart} role="img" aria-label={`${t(locale,"revenueExpenses")} ${year}`}>
     <div className={styles.axis} aria-hidden="true">{ticks.map(tick=><span key={tick}>{hasActivity?compact.format(tick):tick===0?"0":""}</span>)}</div>
     <div className={styles.plot}>
      <div className={styles.rules} aria-hidden="true">{ticks.map(tick=><i key={tick}/>)}</div>
      {monthly.map((month,index)=>{const key=monthKeys[index].key,isCurrent=key===currentKey;return <div className={`${styles.column} ${isCurrent?styles.columnCurrent:""}`} key={key} tabIndex={hasActivity?0:undefined}>
       <div className={styles.bars} style={reveal(index)}>
        <span className={styles.barRevenue} style={{height:`${(month.revenue/axisMax)*100}%`}}/>
        <span className={styles.barExpense} style={{height:`${(month.expense/axisMax)*100}%`}}/>
       </div>
       <small>{monthKeys[index].label}</small>
       {hasActivity?<div className={styles.tooltip} role="tooltip"><b>{monthKeys[index].long}</b><span><i className={styles.legendRevenue}/>{t(locale,"revenue")}<em>{money(month.revenue,currency,locale)}</em></span><span><i className={styles.legendExpense}/>{t(locale,"expenses")}<em>{money(month.expense,currency,locale)}</em></span></div>:null}
      </div>})}
      {hasActivity?null:<div className={styles.chartVoid}><strong>{fr?"Aucune écriture comptabilisée":"No posted entries yet"}</strong><span>{fr?"Importez un relevé bancaire pour voir vos tendances.":"Import a bank statement to see your trends here."}</span></div>}
     </div>
    </div>
   </article>

   <article className={styles.assist} style={reveal(6)}>
    <div className={styles.assistGlow} aria-hidden="true"/>
    <div className={styles.assistHead}>
     <span className={styles.assistMark}><Image src="/zuelen-icon.png" alt="" width={28} height={28}/></span>
     <span className={styles.assistBadge}><Sparkles size={12}/>Zuelen Copilot</span>
    </div>
    <h2>{t(locale,"yourBooksExplained")}</h2>
    <p>{fr?"Posez une question sur la TVA, la trésorerie, les impôts, les factures ou la clôture. Zuelen utilise le contexte de votre exercice sélectionné.":"Ask about VAT, cash, taxes, invoices or year-end. Zuelen uses the context of your selected financial year."}</p>
    <div className={styles.assistAsks}>{copilotPrompts.map(prompt=><Link key={prompt} href={`/app/copilot?prompt=${encodeURIComponent(prompt)}`}><Sparkles size={13}/><span>{prompt}</span><ArrowUpRight size={14}/></Link>)}</div>
    <Link href="/app/copilot" className={styles.assistBar}><span>{fr?"Demandez à Zuelen…":"Ask Zuelen anything…"}</span><i><ArrowRight size={15}/></i></Link>
   </article>
  </section>

  <section className={styles.lowerRow}>
   <article className={`${styles.tile} ${styles.activityTile}`} style={reveal(7)}>
    <div className={styles.tileHead}>
     <div><h2>{t(locale,"latestTransactions")}</h2><p>{fr?"Les mouvements les plus récents de l’exercice":"The latest activity in this financial year"}</p></div>
     <Link href="/app/transactions" className={styles.textLink}>{t(locale,"viewAll")}<ArrowRight size={14}/></Link>
    </div>
    {recent.length===0
     ?<div className={styles.blank}><span><WalletCards size={20}/></span><strong>{t(locale,"noTransactions")}</strong><p>{fr?"Importez un relevé ou ajoutez une transaction pour commencer.":"Import a statement or add a transaction to get started."}</p><div><Link href="/app/banking" className={styles.btnGhost}>{fr?"Importer un relevé":"Import statement"}</Link><Link href="/app/transactions?create=1" className={styles.btnSolid}><Plus size={15}/>{fr?"Ajouter":"Add transaction"}</Link></div></div>
     :<div className={styles.table} role="table">
      <div className={styles.tableHead} role="row"><span role="columnheader">{fr?"Contrepartie":"Counterparty"}</span><span role="columnheader">{fr?"Date":"Date"}</span><span role="columnheader">{fr?"Statut":"Status"}</span><span role="columnheader">{fr?"Montant":"Amount"}</span></div>
      {recent.map(row=>{const income=row.direction==="income",label=row.counterparty_name||row.description||(income?t(locale,"income"):t(locale,"expense")),posted=row.classification_status==="posted";return <Link href="/app/transactions" className={styles.tableRow} role="row" key={row.id}>
       <span className={styles.party} role="cell"><i className={income?styles.avatarIncome:styles.avatarExpense}>{label.trim().charAt(0).toUpperCase()}</i><span><strong>{label}</strong><small>{income?t(locale,"income"):t(locale,"expense")}</small></span></span>
       <span className={styles.date} role="cell">{new Date(`${row.occurred_on}T12:00:00`).toLocaleDateString(dateLocale,{day:"numeric",month:"short",year:"numeric"})}</span>
       <span role="cell"><b className={posted?styles.statusPosted:styles.statusReview}>{posted?t(locale,"posted"):t(locale,"needsReview")}</b></span>
       <span className={`${styles.sum} ${income?styles.sumIncome:""}`} role="cell">{income?"+":"−"}{money(Number(row.amount_gross),row.currency,locale)}</span>
      </Link>})}
     </div>}
   </article>

   {independent
    ?<article className={`${styles.tile} ${styles.taxTile}`} style={reveal(8)}>
     <div className={styles.tileHead}><div><h2>{fr?"Sécurité sociale":"Social security"}</h2><p>{fr?"Cotisations CCSS à prévoir":"CCSS contributions to plan for"}</p></div></div>
     <p className={styles.taxNote}>{fr?"Estimez vos cotisations personnelles à partir de votre bénéfice professionnel et mettez le bon montant de côté.":"Estimate your personal contributions from your professional profit and set the right amount aside."}</p>
     <Link href="/app/ccss" className={styles.btnGhost}>{fr?"Ouvrir CCSS":"Open CCSS"}<ArrowRight size={15}/></Link>
    </article>
    :<article className={`${styles.tile} ${styles.taxTile}`} style={reveal(8)}>
     <div className={styles.tileHead}><div><h2>{fr?"Réserve fiscale":"Tax set-aside"}</h2><p>{fr?"Estimation sur le résultat comptabilisé":"Estimate on the posted result"}</p></div><Link href="/app/taxes" className={styles.iconLink} aria-label={fr?"Ouvrir la fiscalité":"Open taxes"}><ArrowUpRight size={16}/></Link></div>
     <Money value={estimatedTaxes} currency={currency} locale={locale} className={styles.taxTotal}/>
     <div className={styles.taxBar} aria-hidden="true">{estimatedTaxes>0?taxParts.filter(p=>p.value>0).map(part=><span key={part.key} className={styles[`tax_${part.key}`]} style={{flexGrow:part.value}}/>):<span className={styles.tax_none}/>}</div>
     <ul className={styles.taxList}>{taxParts.map(part=><li key={part.key}><i className={styles[`tax_${part.key}`]}/><span title={part.label}>{part.short}</span><b>{part.key==="icc"&&iccRateMissing?(fr?"Taux communal manquant":"Rate not set"):money(part.value,currency,locale)}</b></li>)}</ul>
     <p className={styles.taxNote}>{fr?"Indicatif — basé sur les écritures comptabilisées de l’exercice.":"Indicative — based on posted entries for this financial year."}</p>
     <Link href="/app/taxes" className={styles.btnGhost}>{fr?"Voir la fiscalité":"Open tax overview"}<ArrowRight size={15}/></Link>
    </article>}
  </section>
 </V2Page>;
}
