import { ArrowRight, CircleCheck, Clock3, Eye, ExternalLink, FileText, Pencil, Plus, ReceiptText } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DataEmptyState, DataPanel, DataPanelHeader, DataSummary } from "@/components/zuelen-data-ui-v2";
import { PageHeader, StatusBadge, V2Button, V2Page } from "@/components/zuelen-ui-v2";
import { fiscalYearBounds, getActiveFiscalYear } from "@/lib/fiscal-year";
import { intlLocale, normalizeLocale, type Locale } from "@/lib/i18n";
import { canBookkeep } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import styles from "./invoice-list.module.css";

export const dynamic="force-dynamic";
function money(value:number,currency:string,locale:Locale){return new Intl.NumberFormat(intlLocale(locale),{style:"currency",currency,minimumFractionDigits:2}).format(value)}
function customerName(snapshot:unknown,fr=false){if(!snapshot||typeof snapshot!=="object")return fr?"Client":"Customer";const value=(snapshot as Record<string,unknown>).name;return typeof value==="string"&&value?value:(fr?"Client":"Customer")}
export default async function InvoicesPage(){
 const workspace=await getWorkspace();if(!workspace.authenticated)redirect("/sign-in");if(!workspace.company)redirect("/setup");const locale=normalizeLocale(workspace.profile?.locale),fr=locale==="fr",editable=canBookkeep(workspace.role),year=await getActiveFiscalYear(workspace.company.fiscal_year_start_month),bounds=fiscalYearBounds(year,workspace.company.fiscal_year_start_month),supabase=await createClient();
 const[invoiceResult,paymentResult]=await Promise.all([
  supabase.from("sales_invoices").select("id,invoice_number,status,payment_status,issue_date,service_date,due_date,currency,subtotal,vat_total,total,customer_snapshot,issued_at,created_at").eq("company_id",workspace.company.id).neq("status","void").gte("service_date",bounds.start).lte("service_date",bounds.end).order("service_date",{ascending:false}).order("created_at",{ascending:false}),
  supabase.from("invoice_payments").select("invoice_id,amount,paid_on").eq("company_id",workspace.company.id).lte("paid_on",bounds.end)
 ]);if(invoiceResult.error)throw new Error(`${fr?"Impossible de charger les factures":"Could not load invoices"}: ${invoiceResult.error.message}`);if(paymentResult.error)throw new Error(`${fr?"Impossible de charger les paiements":"Could not load payments"}: ${paymentResult.error.message}`);
 const invoices=invoiceResult.data??[],paidByInvoice=new Map<string,number>();for(const payment of paymentResult.data??[])paidByInvoice.set(payment.invoice_id,(paidByInvoice.get(payment.invoice_id)??0)+Number(payment.amount));const issued=invoices.filter(i=>i.status==="issued"),drafts=invoices.filter(i=>i.status==="draft"),outstanding=issued.reduce((sum,invoice)=>sum+Math.max(0,Number(invoice.total)-(paidByInvoice.get(invoice.id)??0)),0),overdue=issued.filter(invoice=>Math.max(0,Number(invoice.total)-(paidByInvoice.get(invoice.id)??0))>.005&&invoice.due_date<=bounds.end).length,paid=issued.filter(invoice=>Math.max(0,Number(invoice.total)-(paidByInvoice.get(invoice.id)??0))<=.005).length,currency=workspace.company.base_currency||"EUR";
 const date=(value:string,withYear=true)=>new Date(`${value}T12:00:00`).toLocaleDateString(intlLocale(locale),withYear?{day:"2-digit",month:"short",year:"numeric"}:{day:"2-digit",month:"short"});
 return <V2Page>
  <PageHeader
   eyebrow={fr?`Ventes et créances · ${year}`:`Sales & receivables · ${year}`}
   title={fr?"Factures":"Invoices"}
   description={editable?(fr?"Créez des brouillons, émettez des factures et suivez les créances de l'exercice sélectionné.":"Create drafts, issue invoices and inspect receivables in the selected financial year."):(fr?"Accès en lecture seule aux factures, brouillons et créances de l'exercice sélectionné.":"Read-only access to invoices, drafts and receivables in the selected financial year.")}
   actions={editable?[{label:fr?"Nouvelle facture":"New invoice",href:"/app/invoices/new",icon:Plus,variant:"primary"}]:[]}
  />

  <DataSummary items={[
   {label:fr?"Encours à la clôture":"Outstanding at period end",value:money(outstanding,currency,locale),description:fr?`Paiements après le ${date(bounds.end)} exclus`:`Payments after ${bounds.end} excluded`,icon:ReceiptText,tone:outstanding>0?"info":"neutral"},
   {label:fr?"En retard":"Overdue",value:overdue,description:overdue===0?(fr?"Aucun retard":"Nothing past due"):(fr?"Non réglées à la clôture sélectionnée":"Unsettled by the selected year-end"),icon:Clock3,tone:overdue?"warning":"success"},
   {label:fr?"Brouillons":"Drafts",value:drafts.length,description:editable?(fr?"Modifiables · non comptabilisés":"Editable · not posted"):(fr?"Visibles · lecture seule":"Visible · read only"),icon:Pencil},
   {label:fr?"Réglées":"Settled",value:paid,description:fr?`Paiements datés jusqu’au ${date(bounds.end)}`:`Payments dated through ${bounds.end}`,icon:CircleCheck,tone:"success"}
  ]}/>

  <div style={{height:"var(--z-space-6)"}}/>
  <DataPanel>
   <DataPanelHeader eyebrow={fr?`Registre des ventes · ${year}`:`Sales register · ${year}`} title={fr?"Factures et brouillons":"Invoices & drafts"} meta={`${invoices.length} ${fr?`document${invoices.length===1?"":"s"}`:`document${invoices.length===1?"":"s"}`}`}/>
   {invoices.length===0?<DataEmptyState icon={FileText} title={fr?`Aucune facture pour l’exercice ${year}`:`No invoices in financial year ${year}`} description={editable?(fr?`Créez un brouillon avec une date de prestation en ${year}, puis émettez-le lorsque vous souhaitez que Zuelen comptabilise les produits, la TVA et la créance.`:`Create a draft with a ${year} service date, then issue it when you want Zuelen to post revenue, VAT and the receivable.`):(fr?"Aucune facture n’est disponible pour cet exercice.":"No invoices are available in this financial year.")} action={editable?<V2Button label={fr?"Créer une facture":"Create invoice"} href="/app/invoices/new" icon={Plus} variant="primary"/>:undefined}/>:<div className={styles.list}>{invoices.map(invoice=>{const isDraft=invoice.status==="draft",balance=isDraft?0:Math.max(0,Number(invoice.total)-(paidByInvoice.get(invoice.id)??0)),settledByYearEnd=!isDraft&&balance<=.005,isOverdue=!isDraft&&!settledByYearEnd&&invoice.due_date<=bounds.end,status=fr?(isDraft?"Brouillon":settledByYearEnd?"Payée":isOverdue?"En retard":"Ouverte"):(isDraft?"Draft":settledByYearEnd?"Paid":isOverdue?"Overdue":"Open"),tone=isDraft?"neutral":settledByYearEnd?"success":isOverdue?"danger":"info" as const;return <article className={styles.row} key={invoice.id}>
    <div className={styles.invoiceId}><span className={styles.invoiceIcon}><ReceiptText size={16}/></span><div><Link href={`/app/invoices/${invoice.id}`}>{invoice.invoice_number||(fr?"Facture brouillon":"Draft invoice")}<ExternalLink size={11}/></Link><small>{isDraft?(editable?(fr?"Brouillon modifiable":"Editable draft"):(fr?"Brouillon · lecture seule":"Draft · read only")):(fr?`Prestation ${date(invoice.service_date)} · cliquez pour ouvrir`:`Service ${invoice.service_date} · click to open`)}</small></div></div>
    <strong className={styles.customer}>{customerName(invoice.customer_snapshot,fr)}</strong><span className={`${styles.cell} ${styles.issue}`}>{date(invoice.issue_date)}</span><span className={`${styles.cell} ${styles.due}`}>{date(invoice.due_date,false)}</span><span><StatusBadge tone={tone}>{status}</StatusBadge></span><strong className={styles.balance}>{isDraft?"—":money(balance,invoice.currency,locale)}</strong>
    <div className={styles.actions}>{editable&&isDraft?<Link href={`/app/invoices/${invoice.id}/edit`} className={styles.secondary}><Pencil size={12}/>{fr?"Modifier":"Edit"}</Link>:editable&&!settledByYearEnd?<Link className={styles.secondary} href={`/app/invoices/${invoice.id}#payment`}>{fr?"Régler":"Settle"}</Link>:null}<Link href={`/app/invoices/${invoice.id}`} className={styles.open}>{editable?(fr?"Ouvrir":"Open"):(fr?"Voir":"View")} <ArrowRight size={12}/></Link></div>
   </article>})}</div>}
  </DataPanel>
 </V2Page>;
}