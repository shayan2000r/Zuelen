import { ExternalLink, FileCheck2, FileText, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DocumentUploader } from "@/components/document-uploader";
import { DocumentRowActions } from "@/components/document-row-actions";
import { DocumentExtractionButton } from "@/components/document-extraction-button";
import styles from "@/components/documents.module.css";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const typeLabel: Record<string,string> = { receipt:"Receipt", purchase_invoice:"Supplier invoice", bank_statement:"Bank statement", tax_notice:"Tax notice", filing:"Filing", annex:"Annual accounts annex", sales_invoice:"Sales invoice", other:"Other" };
function sizeLabel(bytes: number | null) { if (!bytes) return "—"; return bytes >= 1024*1024 ? `${(bytes/1024/1024).toFixed(2)} MB` : `${Math.max(1,Math.round(bytes/1024))} KB`; }
function money(value:unknown,currency:unknown){if(typeof value!=="number")return null;return new Intl.NumberFormat("en-LU",{style:"currency",currency:typeof currency==="string"&&currency.length===3?currency:"EUR",minimumFractionDigits:2}).format(value)}
function extractionSummary(raw:unknown){if(!raw||typeof raw!=="object")return null;const data=raw as Record<string,unknown>;if(typeof data.error==="string")return{error:data.error};return{supplier:typeof data.supplier_name==="string"?data.supplier_name:null,total:money(data.total,data.currency),vat:money(data.vat_amount,data.currency),category:typeof data.suggested_account_category==="string"?data.suggested_account_category:null,treatment:typeof data.suggested_vat_treatment==="string"?data.suggested_vat_treatment.replaceAll("_"," "):null,confidence:typeof data.confidence==="number"?Math.round(data.confidence*100):null};}

export default async function DocumentsPage() {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in");
  if (!workspace.company || !workspace.organization) redirect("/setup");
  const supabase = await createClient();
  const { data, error } = await supabase.from("documents").select("id,type,file_name,mime_type,file_size,extraction_status,extracted_data,created_at,storage_path").eq("company_id",workspace.company.id).order("created_at",{ascending:false}).limit(150);
  if (error) throw new Error(`Could not load documents: ${error.message}`);
  const docs = data ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.intro}><div><p>Evidence vault</p><h1>Documents</h1><p>Keep the evidence behind every accounting decision in one company-level vault. Files stay private; AI extraction produces reviewable suggestions, never silent postings.</p></div><span className={styles.securityPill}><LockKeyhole size={13}/>Private storage · RLS protected</span></div>
      <section className={styles.grid}>
        <DocumentUploader organizationId={workspace.organization.id} companyId={workspace.company.id}/>
        <article className={styles.library}>
          <div className={styles.libraryHead}><div><p>Document inbox</p><h2>Company evidence</h2></div><span>{docs.length} files</span></div>
          {docs.length===0 ? <div className={styles.empty}><div className={styles.emptyIcon}><FileCheck2 size={23}/></div><h3>Your document trail starts here.</h3><p>Upload a receipt, supplier invoice, bank statement or authority letter. Compta can then extract the facts and prepare a bookkeeping suggestion for review.</p></div> : <div className={styles.docList}>{docs.map(doc=>{const extracted=extractionSummary(doc.extracted_data);const aiSupported=["application/pdf","image/jpeg","image/png","image/webp"].includes(doc.mime_type??"");return <article className={styles.docRow} key={doc.id}>
            <div className={styles.docIdentity}><span className={styles.docIcon}><FileText size={17}/></span><div><strong>{doc.file_name}</strong><small>{sizeLabel(doc.file_size)} · {doc.mime_type?.replace("application/","").replace("image/","") || "file"}</small></div></div>
            <div className={styles.docMeta}><span className={styles.typePill}>{typeLabel[doc.type] ?? doc.type}</span><span>{new Date(doc.created_at).toLocaleDateString("en-LU",{day:"2-digit",month:"short",year:"numeric"})}</span><span className={styles.statusPill}>{doc.extraction_status.replaceAll("_"," ")}</span></div>
            <div className={styles.extractionArea}>{extracted&&!extracted.error?<><div className={styles.aiSummaryHead}><Sparkles size={12}/><strong>{extracted.supplier||"Extracted document"}</strong>{extracted.confidence!==null?<span>{extracted.confidence}% confidence</span>:null}</div><div className={styles.aiSummaryGrid}><span><small>Total</small><strong>{extracted.total||"—"}</strong></span><span><small>VAT</small><strong>{extracted.vat||"—"}</strong></span><span><small>Suggestion</small><strong>{extracted.category||extracted.treatment||"Review needed"}</strong></span></div></>:extracted?.error?<span className={styles.extractionError}>{extracted.error}</span>:<p>Run AI extraction to identify supplier, dates, amounts, VAT and a cautious bookkeeping suggestion.</p>}</div>
            <div className={styles.docActions}><Link href={`/app/documents/${doc.id}/open`} target="_blank" className={styles.openButton}>Open <ExternalLink size={11}/></Link>{aiSupported?<DocumentExtractionButton documentId={doc.id} status={doc.extraction_status}/>:null}<DocumentRowActions id={doc.id} storagePath={doc.storage_path} fileName={doc.file_name} type={doc.type as "receipt"|"purchase_invoice"|"bank_statement"|"tax_notice"|"filing"|"annex"|"other"}/></div>
          </article>})}</div>}
          <div className={styles.footer}><ShieldCheck size={13}/>Original files remain separate from accounting entries; extracted data must be reviewed before bookkeeping.</div>
        </article>
      </section>
    </div>
  );
}
