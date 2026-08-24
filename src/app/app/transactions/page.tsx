import { CheckCircle2, CircleHelp, Eye, FileUp, ListChecks, Search, Sparkles, WalletCards } from "lucide-react";
import { redirect } from "next/navigation";
import { SourceTransactionForm } from "@/components/source-transaction-form";
import { TransactionReviewCard } from "@/components/transaction-review-card";
import { TransactionBulkActions } from "@/components/transaction-bulk-actions";
import { TransactionTable } from "@/components/transaction-table";
import { DataEmptyState, DataPanel, DataPanelHeader, DataSummary, DataToolbar } from "@/components/zuelen-data-ui-v2";
import { PageHeader, V2Button, V2Page } from "@/components/zuelen-ui-v2";
import { defaultDateForFiscalYear, fiscalYearBounds, getActiveFiscalYear } from "@/lib/fiscal-year";
import { localizedAccountLabel, normalizeLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { canBookkeep } from "@/lib/permissions";
import styles from "./transactions.module.css";

export const dynamic="force-dynamic";
type SearchParams=Promise<{q?:string;status?:string}>;

export default async function TransactionsPage({searchParams}:{searchParams:SearchParams}){
 const params=await searchParams,q=(params.q??"").trim().toLowerCase(),status=params.status??"all";const workspace=await getWorkspace();if(!workspace.authenticated)redirect("/sign-in");if(!workspace.company)redirect("/setup");const locale=normalizeLocale(workspace.profile?.locale),fr=locale==="fr",editable=canBookkeep(workspace.role),year=await getActiveFiscalYear(workspace.company.fiscal_year_start_month),bounds=fiscalYearBounds(year,workspace.company.fiscal_year_start_month),defaultDate=defaultDateForFiscalYear(year,workspace.company.fiscal_year_start_month),supabase=await createClient();
 const[{data,error},{data:accountData,error:accountError}]=await Promise.all([
  supabase.from("source_transactions").select("id,occurred_on,direction,amount_gross,amount_net,vat_amount,vat_rate,vat_treatment,counterparty_country,currency,counterparty_name,description,classification_status,posted_journal_entry_id,suggested_account_id,suggestion_confidence,suggestion_reason,suggestion_kind").eq("company_id",workspace.company.id).not("classification_status","in",'(reversed,ignored)').gte("occurred_on",bounds.start).lte("occurred_on",bounds.end).order("occurred_on",{ascending:false}).order("created_at",{ascending:false}).limit(500),
  supabase.from("company_accounts").select("id,code,label,label_en,label_fr,account_type,is_active").eq("company_id",workspace.company.id).eq("is_active",true).order("code",{ascending:true})]);
 if(error)throw new Error(fr?`Impossible de charger les transactions : ${error.message}`:`Could not load transactions: ${error.message}`);if(accountError)throw new Error(fr?`Impossible de charger les catégories comptables : ${accountError.message}`:`Could not load accounting categories: ${accountError.message}`);const rows=data??[],accounts=(accountData??[]).filter(a=>["expense","revenue","asset","liability"].includes(a.account_type)).map(a=>({...a,label:localizedAccountLabel(locale,a)}));
 const postedIds=rows.map(r=>r.posted_journal_entry_id).filter((id):id is string=>Boolean(id)),entryNumbers=new Map<string,number>();if(postedIds.length){const{data:entries}=await supabase.from("journal_entries").select("id,entry_number").in("id",postedIds);for(const e of entries??[])entryNumbers.set(e.id,Number(e.entry_number))}
 const pendingRows=rows.filter(r=>["unclassified","review","classified"].includes(r.classification_status)),nextReview=pendingRows[0]??null,suggestedCount=pendingRows.filter(r=>r.suggested_account_id&&Number(r.suggestion_confidence??0)>=.7).length,unresolvedCount=pendingRows.length-suggestedCount,postedCount=rows.filter(r=>r.classification_status==="posted").length;
 const visibleRows=rows.filter(r=>{const statusMatch=status==="all"||(status==="posted"?r.classification_status==="posted":status==="review"?r.classification_status!=="posted":true);if(!statusMatch)return false;if(!q)return true;return[r.counterparty_name,r.description,r.currency,r.classification_status,r.vat_treatment,r.counterparty_country].filter(Boolean).join(" ").toLowerCase().includes(q)}).map(row=>{const suggested=row.suggested_account_id?accounts.find(a=>a.id===row.suggested_account_id):undefined;return{...row,entry_number:row.posted_journal_entry_id?entryNumbers.get(row.posted_journal_entry_id)??null:null,suggested_code:suggested?.code??null,suggested_label:suggested?.label??null}});
 const noResults=rows.length>0&&visibleRows.length===0;

 return <V2Page>
  <PageHeader
   eyebrow={fr?`Source comptable · ${year}`:`Bookkeeping source · ${year}`}
   title="Transactions"
   description={editable?(fr?`Vérifiez, classez et gérez l'activité ${year} sans perdre la piste d'audit.`:`Review, classify and manage ${year} activity without losing the audit trail.`):(fr?`Accès en lecture seule à l'activité transactionnelle ${year} et à l'historique de comptabilisation.`:`Read-only access to ${year} transaction activity and posting history.`)}
   actions={editable?[
    {label:fr?"Importer un relevé":"Import statement",href:"/app/banking",icon:FileUp,variant:"secondary"},
    {label:fr?"Ajouter une transaction":"Add transaction",href:"#add-transaction",icon:WalletCards,variant:"primary"}
   ]:[]}
  />

  <DataSummary items={[
   {label:fr?"Transactions actives":"Active transactions",value:rows.length,description:fr?`Exercice ${year}`:`Financial year ${year}`,icon:WalletCards},
   {label:fr?"À vérifier":"Needs review",value:pendingRows.length,description:pendingRows.length?(fr?"Action requise":"Action required"):(fr?"Tout est à jour":"All caught up"),icon:CircleHelp,tone:pendingRows.length?"warning":"success"},
   {label:fr?"Comptabilisées":"Posted",value:postedCount,description:fr?"Écritures avec piste d’audit":"Entries with audit trail",icon:CheckCircle2,tone:"success"},
   {label:fr?"Suggestions prêtes":"Ready suggestions",value:suggestedCount,description:unresolvedCount?(fr?`${unresolvedCount} à classer manuellement`:`${unresolvedCount} still need manual review`):(fr?"Aucune suggestion bloquée":"No blocked suggestions"),icon:Sparkles,tone:suggestedCount?"info":"neutral"}
  ]}/>

  <div className={styles.flow}>
   {editable?<div id="add-transaction"><SourceTransactionForm defaultDate={defaultDate}/></div>:<div className={styles.reviewBanner}><span><Eye size={16}/></span><div><strong>{fr?"Accès lecteur · lecture seule":"Viewer access · read only"}</strong><small>{fr?"Vous pouvez consulter les transactions et les références de journal, mais pas créer, modifier, comptabiliser ou supprimer une activité.":"You can inspect transactions and journal references, but you cannot create, edit, post or delete activity."}</small></div></div>}

   {editable&&pendingRows.length?<TransactionBulkActions suggestedCount={suggestedCount} unresolvedCount={unresolvedCount}/>:null}
   {editable&&nextReview?<TransactionReviewCard transaction={nextReview} accounts={accounts}/>:editable&&!nextReview&&rows.length?<div className={styles.reviewBanner}><span><CheckCircle2 size={16}/></span><div><strong>{fr?`Boîte comptable ${year} traitée`:`${year} accounting inbox cleared`}</strong><small>{fr?"Toutes les transactions actives de cet exercice ont été classées et comptabilisées.":"Every active transaction in this financial year has been classified and posted."}</small></div></div>:null}

   <DataPanel>
    <DataPanelHeader eyebrow={fr?`Journal d'activité · ${year}`:`Activity log · ${year}`} title={fr?"Transactions enregistrées":"Recorded transactions"} meta={fr?`${visibleRows.length} affichées · plus récentes d'abord`:`${visibleRows.length} shown · newest first`}/>
    <DataToolbar>
     <form className={styles.tools} method="get">
      <label><Search size={15}/><input name="q" defaultValue={params.q??""} placeholder={fr?`Rechercher dans les transactions ${year}`:`Search ${year} transactions`}/></label>
      <select name="status" defaultValue={status}><option value="all">{fr?"Tous les statuts":"All statuses"}</option><option value="review">{fr?"À vérifier":"Needs review"}</option><option value="posted">{fr?"Comptabilisées":"Posted"}</option></select>
      <button type="submit">{fr?"Appliquer":"Apply"}</button>
     </form>
    </DataToolbar>

    {visibleRows.length===0?<DataEmptyState
      icon={noResults?Search:ListChecks}
      title={noResults?(fr?"Aucun résultat":"No matching transactions"):(fr?"Aucune transaction pour le moment":"No transactions yet")}
      description={noResults?(fr?"Aucune transaction ne correspond à votre recherche ou à vos filtres. Essayez de les modifier ou de les réinitialiser.":"No transactions match your current search or filters. Try changing or clearing them."):(editable?(fr?"Ajoutez une transaction ou importez un relevé bancaire pour commencer à suivre votre activité financière.":"Add a transaction or import a bank statement to start tracking your financial activity."):(fr?`Aucune transaction n'est disponible pour l'exercice ${year}.`:`No transactions are available for financial year ${year}.`))}
      action={noResults?<V2Button label={fr?"Réinitialiser les filtres":"Clear filters"} href="/app/transactions" variant="secondary"/>:editable?<div className={styles.emptyActions}><V2Button label={fr?"Ajouter une transaction":"Add transaction"} href="#add-transaction" variant="primary"/><V2Button label={fr?"Importer un relevé":"Import statement"} href="/app/banking" variant="secondary"/></div>:undefined}
    />:<TransactionTable rows={visibleRows} accounts={accounts} readOnly={!editable}/>} 
   </DataPanel>
  </div>
 </V2Page>;
}
