import { buildFinancialDocumentPdf } from "@/lib/financial-document-pdf";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export const dynamic="force-dynamic";
export const runtime="nodejs";
function safeName(value:string){return value.normalize("NFKD").replace(/[^a-zA-Z0-9-_ ]+/g,"").trim().replace(/\s+/g,"-").slice(0,100)||"financial-document"}
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){const{id}=await params,workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return new Response("Unauthorized",{status:401});const supabase=await createClient(),{data,error}=await supabase.from("generated_documents").select("id,title,document_type,payload,fiscal_year").eq("id",id).eq("company_id",workspace.company.id).maybeSingle();if(error)return new Response(error.message,{status:500});if(!data)return new Response("Not found",{status:404});try{const bytes=await buildFinancialDocumentPdf(data.payload as Record<string,unknown>,data.document_type,data.title);return new Response(Buffer.from(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename=\"${safeName(data.title)}.pdf\"`,"Cache-Control":"private, no-store"}})}catch(error){return new Response(error instanceof Error?error.message:"PDF generation failed",{status:500})}}
