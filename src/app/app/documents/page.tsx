import { ExternalLink, FileCheck2, FileText, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DocumentUploader } from "@/components/document-uploader";
import styles from "@/components/documents.module.css";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const typeLabel: Record<string,string> = { receipt:"Receipt", purchase_invoice:"Supplier invoice", bank_statement:"Bank statement", tax_notice:"Tax notice", filing:"Filing", annex:"Annual accounts annex", sales_invoice:"Sales invoice", other:"Other" };
function sizeLabel(bytes: number | null) { if (!bytes) return "—"; return bytes >= 1024*1024 ? `${(bytes/1024/1024).toFixed(2)} MB` : `${Math.max(1,Math.round(bytes/1024))} KB`; }

export default async function DocumentsPage() {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in");
  if (!workspace.company || !workspace.organization) redirect("/setup");
  const supabase = await createClient();
  const { data, error } = await supabase.from("documents").select("id,type,file_name,mime_type,file_size,extraction_status,created_at").eq("company_id",workspace.company.id).order("created_at",{ascending:false}).limit(150);
  if (error) throw new Error(`Could not load documents: ${error.message}`);
  const docs = data ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.intro}><div><p>Evidence vault</p><h1>Documents</h1><p>Keep the evidence behind every accounting decision in one company-level vault. Files are private and accessed through short-lived secure links.</p></div><span className={styles.securityPill}><LockKeyhole size={13}/>Private storage · RLS protected</span></div>
      <section className={styles.grid}>
        <DocumentUploader organizationId={workspace.organization.id} companyId={workspace.company.id}/>
        <article className={styles.library}>
          <div className={styles.libraryHead}><div><p>Document inbox</p><h2>Company evidence</h2></div><span>{docs.length} files</span></div>
          {docs.length===0 ? <div className={styles.empty}><div className={styles.emptyIcon}><FileCheck2 size={23}/></div><h3>Your document trail starts here.</h3><p>Upload a receipt, supplier invoice, bank statement or authority letter. Extraction and accounting suggestions will build on this secure source.</p></div> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Document</th><th>Type</th><th>Uploaded</th><th>Status</th><th>Open</th></tr></thead><tbody>{docs.map(doc=><tr key={doc.id}><td><div className={styles.docName}><span className={styles.docIcon}><FileText size={16}/></span><div><strong>{doc.file_name}</strong><small>{sizeLabel(doc.file_size)} · {doc.mime_type?.replace("application/","").replace("image/","") || "file"}</small></div></div></td><td><span className={styles.typePill}>{typeLabel[doc.type] ?? doc.type}</span></td><td>{new Date(doc.created_at).toLocaleDateString("en-LU",{day:"2-digit",month:"short",year:"numeric"})}</td><td><span className={styles.statusPill}>{doc.extraction_status.replaceAll("_"," ")}</span></td><td><Link href={`/app/documents/${doc.id}/open`} target="_blank" className={styles.openLink}>Open <ExternalLink size={11}/></Link></td></tr>)}</tbody></table></div>}
          <div className={styles.footer}><ShieldCheck size={13}/>Original files remain separate from accounting entries; Compta keeps the evidence trail intact.</div>
        </article>
      </section>
    </div>
  );
}
