import { buildFinancialDocumentCsv } from "@/lib/financial-document-csv";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export const dynamic="force-dynamic";
function safeName(value:string){return value.normalize("NFKD").replace(/[^a-zA-Z0-9-_ ]+/g,"").trim().replace(/\s+/g,"-").slice(0,100)||"financial-document"}
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){const{id}=await params,workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return new Response("Unauthorized",{status:401});const supabase=await createClient(),{data,error}=await supabase.from("generated_documents").select("id,title,document_type,payload").eq("id",id).eq("company_id",workspace.company.id).maybeSingle();if(error)return new Response(error.message,{status:500});if(!data)return new Response("Not found",{status:404});try{const csv=buildFinancialDocumentCsv(data.payload as Record<string,unknown>,data.document_type);return new Response(`\uFEFF${csv}`,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename=\"${safeName(data.title)}.csv\"`,`Cache-Control":"private, no-store"}})}catch(error){return new Response(error instanceof Error?error.message:"CSV generation failed",{status:400})}}
