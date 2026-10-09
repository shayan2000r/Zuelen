import { redirect } from "next/navigation";
import { fiscalYearBounds, getActiveFiscalYear } from "@/lib/fiscal-year";
import { intlLocale, normalizeLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { OverviewView } from "./overview-view";
import { corporateIncomeTax, EMPLOYMENT_FUND_RATE, municipalBusinessTax } from "@/lib/tax-rules/corporate";

export const dynamic = "force-dynamic";
type LedgerLine={journal_entry_id:string;company_account_id:string;debit:number|string;credit:number|string};
type Account={id:string;code:string;account_type:string};

export default async function OverviewPage(){
 const workspace=await getWorkspace();if(!workspace.authenticated)redirect("/sign-in");if(!workspace.company)redirect("/setup");
 const locale=normalizeLocale(workspace.profile?.locale),fr=locale==="fr",independent=workspace.company.entity_kind==="independent",dateLocale=intlLocale(locale),now=new Date(),year=await getActiveFiscalYear(workspace.company.fiscal_year_start_month),bounds=fiscalYearBounds(year,workspace.company.fiscal_year_start_month),currency=workspace.company.base_currency||"EUR",supabase=await createClient();
 const monthKeys=Array.from({length:12},(_,index)=>{const d=new Date(Date.UTC(year,workspace.company!.fiscal_year_start_month-1+index,1));return{key:d.toISOString().slice(0,7),label:d.toLocaleDateString(dateLocale,{month:"short",timeZone:"UTC"}).replace(".","").slice(0,3),long:d.toLocaleDateString(dateLocale,{month:"long",year:"numeric",timeZone:"UTC"})}}),monthIndex=new Map(monthKeys.map((month,index)=>[month.key,index]));
 const[entriesResult,accountsResult,transactionsResult,taxProfileResult]=await Promise.all([
  supabase.from("journal_entries").select("id,entry_date").eq("company_id",workspace.company.id).eq("status","posted").gte("entry_date",bounds.start).lte("entry_date",bounds.end),
  supabase.from("company_accounts").select("id,code,account_type").eq("company_id",workspace.company.id),
  supabase.from("source_transactions").select("id,occurred_on,direction,amount_gross,currency,counterparty_name,description,classification_status").eq("company_id",workspace.company.id).not("classification_status","in",'(reversed,ignored)').gte("occurred_on",bounds.start).lte("occurred_on",bounds.end).order("occurred_on",{ascending:false}).order("created_at",{ascending:false}).limit(6),
  independent?Promise.resolve({data:null,error:null}):supabase.from("company_tax_profiles").select("icc_multiplier,icc_multiplier_year").eq("company_id",workspace.company.id).maybeSingle(),
 ]);
 for(const result of[entriesResult,accountsResult,transactionsResult,taxProfileResult])if(result.error)throw new Error(result.error.message);
 const entries=entriesResult.data??[],accounts=(accountsResult.data??[]) as Account[],accountMap=new Map(accounts.map(a=>[a.id,a])),dateMap=new Map(entries.map(e=>[e.id,e.entry_date])),monthly=Array.from({length:12},()=>({revenue:0,expense:0}));
 let lines:LedgerLine[]=[];if(entries.length){const r=await supabase.from("journal_lines").select("journal_entry_id,company_account_id,debit,credit").in("journal_entry_id",entries.map(e=>e.id));if(r.error)throw new Error(r.error.message);lines=(r.data??[]) as LedgerLine[]}
 let revenue=0,expenses=0,outputVat=0,inputVat=0;for(const line of lines){const a=accountMap.get(line.company_account_id);if(!a)continue;const d=Number(line.debit),c=Number(line.credit),date=dateMap.get(line.journal_entry_id),index=date?monthIndex.get(date.slice(0,7)):-1;if(a.account_type==="revenue"){const v=c-d;revenue+=v;if(index!==undefined&&index>=0)monthly[index].revenue+=v}if(a.account_type==="expense"&&!['6711','6721','6811'].includes(a.code)){const v=d-c;expenses+=v;if(index!==undefined&&index>=0)monthly[index].expense+=v}if(a.code==="461411")outputVat+=c-d;if(a.code==="421611")inputVat+=d-c}
 const profit=revenue-expenses,vat=outputVat-inputVat,profitForTax=Math.max(0,profit),ircTax=independent?0:(corporateIncomeTax(profitForTax,year)??0),fund=ircTax*EMPLOYMENT_FUND_RATE,profileYear=Number(taxProfileResult.data?.icc_multiplier_year),multiplier=profileYear===year&&taxProfileResult.data?.icc_multiplier!=null?Number(taxProfileResult.data.icc_multiplier):null,icc=independent||multiplier===null?0:municipalBusinessTax(profitForTax,multiplier);
 const hour=now.getHours(),greeting=fr?(hour<18?"Bonjour":"Bonsoir"):(hour<12?"Good morning":hour<18?"Good afternoon":"Good evening");
 return <OverviewView data={{
  locale,independent,hasVat:Boolean(workspace.capabilities?.hasVat),greeting,name:workspace.company.trading_name||workspace.company.legal_name,currency,
  year,bounds,currentMonthKey:now.toISOString().slice(0,7),months:monthKeys.map((month,index)=>({...month,...monthly[index]})),
  revenue,expenses,vat,ircTax,fund,icc,iccRateMissing:!independent&&multiplier===null,recent:transactionsResult.data??[],
 }}/>;
}
