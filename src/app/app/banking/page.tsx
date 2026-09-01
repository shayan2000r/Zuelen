import { CheckCircle2, CircleHelp, Landmark, Search, WalletCards } from "lucide-react";
import { redirect } from "next/navigation";
import { BankImporter } from "@/components/bank-importer";
import { BankMovementTable } from "@/components/bank-movement-table";
import { BankImportHistory } from "@/components/bank-import-history";
import { DataEmptyState, DataPanel, DataPanelHeader, DataSummary, DataToolbar } from "@/components/zuelen-data-ui-v2";
import { PageHeader, Panel, V2Button, V2Page } from "@/components/zuelen-ui-v2";
import styles from "@/components/banking.module.css";
import { fiscalYearBounds, getActiveFiscalYear } from "@/lib/fiscal-year";
import { normalizeLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { canBookkeep } from "@/lib/permissions";

export const dynamic="force-dynamic";
type SearchParams=Promise<{q?:string;status?:string;import?:string}>;

export default async function BankingPage({searchParams}:{searchParams:SearchParams}){
 const params=await searchParams,q=(params.q??"").trim().toLowerCase(),status=params.status??"all",workspace=await getWorkspace();if(!workspace.authenticated)redirect("/sign-in");if(!workspace.company)redirect("/setup");
 const locale=normalizeLocale(workspace.profile?.locale),fr=locale==="fr",editable=canBookkeep(workspace.role),year=await getActiveFiscalYear(workspace.company.fiscal_year_start_month),bounds=fiscalYearBounds(year,workspace.company.fiscal_year_start_month),supabase=await createClient();
 const[accountsResult,bankResult,batchesResult]=await Promise.all([
  supabase.from("bank_accounts").select("id,name,iban,currency,opening_balance").eq("company_id",workspace.company.id).order("created_at"),
  supabase.from("bank_transactions").select("id,bank_account_id,booking_date,amount,currency,counterparty_name,reference,match_status,matched_journal_entry_id,import_source,import_batch_id").eq("company_id",workspace.company.id).neq("match_status","ignored").gte("booking_date",bounds.start).lte("booking_date",bounds.end).order("booking_date",{ascending:false}).order("created_at",{ascending:false}).limit(1200),
  supabase.from("bank_import_batches").select("id,file_name,row_count,imported_count,duplicate_count,created_at").eq("company_id",workspace.company.id).order("created_at",{ascending:false}).limit(10)
 ]);
 if(accountsResult.error)throw new Error(`${fr?"Impossible de charger les comptes bancaires":"Could not load bank accounts"}: ${accountsResult.error.message}`);if(bankResult.error)throw new Error(`${fr?"Impossible de charger les mouvements bancaires":"Could not load bank transactions"}: ${bankResult.error.message}`);if(batchesResult.error)throw new Error(`${fr?"Impossible de charger les imports bancaires":"Could not load bank imports"}: ${batchesResult.error.message}`);
 const accounts=accountsResult.data??[],rows=bankResult.data??[],rawBatches=batchesResult.data??[],currency=workspace.company.base_currency||"EUR",matched=rows.filter(r=>r.match_status==="matched").length,unmatched=rows.filter(r=>r.match_status!=="matched").length,coverage=rows.length?Math.round(matched/rows.length*100):100,accountMap=new Map(accounts.map(a=>[a.id,a]));
 const visibleRows=rows.filter(row=>{const statusMatch=status==="all"||(status==="matched"?row.match_status==="matched":status==="review"?row.match_status!=="matched":true);if(!statusMatch)return false;if(!q)return true;const account=accountMap.get(row.bank_account_id);return[row.counterparty_name,row.reference,row.currency,row.match_status,account?.name,account?.iban].filter(Boolean).join(" ").toLowerCase().includes(q)});
 const batchIds=rawBatches.map(b=>b.id),batchRows=batchIds.length?(await supabase.from("bank_transactions").select("id,import_batch_id,booking_date,amount,currency,match_status").in("import_batch_id",batchIds)).data??[]:[],signatureGroups=new Map<string,string[]>(),batchMeta=new Map<string,{signature:string;activeCount:number}>();
 for(const batch of rawBatches){const items=batchRows.filter(r=>r.import_batch_id===batch.id),signature=items.map(r=>`${r.booking_date}|${Number(r.amount).toFixed(2)}|${r.currency}`).sort().join(";");batchMeta.set(batch.id,{signature,activeCount:items.filter(r=>r.match_status!=="ignored").length});if(signature){const list=signatureGroups.get(signature)??[];list.push(batch.id);signatureGroups.set(signature,list)}}
 const batches=rawBatches.map(b=>{const meta=batchMeta.get(b.id);return{...b,activeCount:meta?.activeCount??0,isPotentialDuplicate:Boolean(meta?.signature&&(signatureGroups.get(meta.signature)?.length??0)>1)}}),noResults=rows.length>0&&visibleRows.length===0;

 return <V2Page>
  <PageHeader
   eyebrow={fr?`Trésorerie → comptabilité · ${year}`:`Cash → books · ${year}`}
   title={fr?"Banque":"Banking"}
   description={editable?(fr?`Importez les relevés ${year} et rapprochez-les avec le grand livre.`:`Import ${year} statements and reconcile them with the ledger.`):(fr?`Accès en lecture seule aux relevés et rapprochements ${year}.`:`Read-only access to ${year} statements and reconciliation history.`)}
  />

  <DataSummary items={[
   {label:fr?"Comptes bancaires":"Bank accounts",value:accounts.length,description:fr?"Comptes connectés ou suivis":"Accounts currently tracked",icon:Landmark},
   {label:fr?"Mouvements":"Bank movements",value:rows.length,description:fr?`Exercice ${year}`:`Financial year ${year}`,icon:WalletCards},
   {label:fr?"À rapprocher":"Needs reconciliation",value:unmatched,description:unmatched?(fr?"Action requise":"Action required"):(fr?"Tout est rapproché":"Everything reconciled"),icon:CircleHelp,tone:unmatched?"warning":"success"},
   {label:fr?"Couverture":"Reconciliation coverage",value:`${coverage}%`,description:fr?`${matched} mouvement${matched===1?"":"s"} rapproché${matched===1?"":"s"}`:`${matched} movement${matched===1?"":"s"} reconciled`,icon:CheckCircle2,tone:coverage===100?"success":"info"}
  ]}/>

  <div style={{height:"var(--z-space-6)"}}/>
  <section className={styles.layout}>
   <div id="bank-import">
    {editable?<BankImporter defaultCurrency={currency} initialOpen={params.import==="1"}/>:<Panel><div className={styles.importHistory}><div><p>{fr?"Imports de relevés bancaires":"Bank statement imports"}</p><h2>{fr?"Accès en lecture seule":"Read-only access"}</h2></div><span>{fr?"Seuls les propriétaires, administrateurs, comptables et aides-comptables peuvent importer ou supprimer des justificatifs bancaires.":"Only Owners, Admins, Accountants and Bookkeepers can import or remove bank evidence."}</span></div></Panel>}
   </div>
   <div className={styles.right}>
    <DataPanel>
     <DataPanelHeader eyebrow={fr?`File de rapprochement · ${year}`:`Reconciliation queue · ${year}`} title={fr?"Mouvements bancaires":"Bank movements"} meta={fr?`${visibleRows.length} affichés`:`${visibleRows.length} shown`}/>
     <DataToolbar>
      <form method="get">
       <label><Search size={15}/><input name="q" defaultValue={params.q??""} placeholder={fr?`Rechercher dans les mouvements ${year}`:`Search ${year} bank movements`}/></label>
       <select name="status" defaultValue={status}><option value="all">{fr?"Tous les statuts":"All statuses"}</option><option value="review">{fr?"À vérifier":"Needs review"}</option><option value="matched">{fr?"Rapprochés":"Reconciled"}</option></select>
       <button type="submit">{fr?"Appliquer":"Apply"}</button>
      </form>
     </DataToolbar>
     {visibleRows.length===0?<DataEmptyState icon={noResults?Search:Landmark} title={noResults?(fr?"Aucun mouvement correspondant":"No matching bank movements"):(fr?`Aucune activité bancaire en ${year}`:`No bank activity in ${year} yet`)} description={noResults?(fr?"Essayez une autre recherche ou un autre filtre de rapprochement.":"Try a different search or reconciliation filter."):editable?(fr?`Importez votre relevé bancaire ${year}. Zuelen créera des transactions vérifiables à partir des dates du relevé.`:`Import your ${year} bank statement. Zuelen will create reviewable transactions dated from the statement.`):(fr?"Aucune activité de relevé n'a été importée pour cet exercice.":"No statement activity has been imported for this year.")} action={noResults?<V2Button label={fr?"Effacer les filtres":"Clear filters"} href="/app/banking" variant="secondary"/>:undefined}/>:<BankMovementTable rows={visibleRows} accounts={accounts.map(a=>({id:a.id,name:a.name}))} readOnly={!editable}/>} 
    </DataPanel>
    <BankImportHistory batches={batches} readOnly={!editable}/>
   </div>
  </section>
 </V2Page>;
}
