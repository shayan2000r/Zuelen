"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export type DocumentExtractionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function validUuid(value:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)}

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["document_kind","supplier_name","invoice_number","document_date","supplier_country","supplier_vat_number","currency","subtotal","vat_amount","total","vat_rate","suggested_vat_treatment","suggested_account_category","confidence","notes"],
  properties: {
    document_kind: { type: "string", enum: ["receipt","purchase_invoice","tax_notice","other"] },
    supplier_name: { type: ["string","null"] },
    invoice_number: { type: ["string","null"] },
    document_date: { type: ["string","null"], description: "ISO YYYY-MM-DD when visible" },
    supplier_country: { type: ["string","null"], description: "ISO alpha-2 country code when inferable from the document" },
    supplier_vat_number: { type: ["string","null"] },
    currency: { type: ["string","null"] },
    subtotal: { type: ["number","null"] },
    vat_amount: { type: ["number","null"] },
    total: { type: ["number","null"] },
    vat_rate: { type: ["number","null"] },
    suggested_vat_treatment: { type: "string", enum: ["domestic","eu_b2b_reverse_charge","non_eu","exempt_or_zero","unknown"] },
    suggested_account_category: { type: ["string","null"], description: "Plain-language accounting category only; do not invent a PCN code" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    notes: { type: "string" }
  }
} as const;

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const output=(payload as {output?:unknown[]}).output;
  if(!Array.isArray(output))return null;
  for(const item of output){
    if(!item||typeof item!=="object")continue;
    const content=(item as {content?:unknown[]}).content;
    if(!Array.isArray(content))continue;
    for(const part of content){
      if(part&&typeof part==="object"&&(part as {type?:string}).type==="output_text"){
        const text=(part as {text?:unknown}).text;
        if(typeof text==="string")return text;
      }
    }
  }
  return null;
}

export async function extractDocumentAction(_previous:DocumentExtractionState,formData:FormData):Promise<DocumentExtractionState>{
  const workspace=await getWorkspace();
  if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};
  const documentId=String(formData.get("document_id")??"").trim();
  if(!validUuid(documentId))return{status:"error",message:"Invalid document reference."};
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey)return{status:"error",message:"OpenAI extraction is not configured on this deployment yet."};

  const supabase=await createClient();
  const{data:doc,error:docError}=await supabase.from("documents").select("id,company_id,file_name,mime_type,file_size,storage_path,type").eq("id",documentId).eq("company_id",workspace.company.id).maybeSingle();
  if(docError||!doc)return{status:"error",message:docError?.message??"Document not found."};
  const mime=doc.mime_type??"";
  if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(mime))return{status:"error",message:"AI extraction currently supports PDF, JPG, PNG and WebP documents."};
  if(Number(doc.file_size??0)>12*1024*1024)return{status:"error",message:"AI extraction currently supports documents up to 12 MB."};

  await supabase.from("documents").update({extraction_status:"processing"}).eq("id",doc.id);
  try{
    const{data:file,error:fileError}=await supabase.storage.from("company-documents").download(doc.storage_path);
    if(fileError||!file)throw new Error(fileError?.message??"Could not read the private document.");
    const bytes=Buffer.from(await file.arrayBuffer());
    const base64=bytes.toString("base64");
    const filePart = mime.startsWith("image/")
      ? {type:"input_image",image_url:`data:${mime};base64,${base64}`,detail:"high"}
      : {type:"input_file",filename:doc.file_name,file_data:base64};

    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"gpt-5-mini",
        input:[
          {role:"developer",content:[{type:"input_text",text:"You extract bookkeeping facts from business documents for a Luxembourg accounting application. Extract only facts visible in the document. Use null when information is absent. VAT treatment and account category are suggestions only. Never invent a Luxembourg PCN code, tax conclusion, or legal conclusion."}]},
          {role:"user",content:[{type:"input_text",text:"Extract the supplier/invoice/amount/VAT facts from this document and provide a cautious bookkeeping suggestion."},filePart]}
        ],
        text:{format:{type:"json_schema",name:"compta_document_extraction",strict:true,schema}},
        max_output_tokens:1200
      })
    });
    const payload=await response.json();
    if(!response.ok){
      const apiMessage=payload&&typeof payload==="object"&&"error" in payload?String((payload as {error?:{message?:string}}).error?.message??"OpenAI extraction failed."):"OpenAI extraction failed.";
      throw new Error(apiMessage);
    }
    const outputText=extractOutputText(payload);
    if(!outputText)throw new Error("The extraction model returned no structured result.");
    const extracted=JSON.parse(outputText) as Record<string,unknown>;
    await supabase.from("documents").update({extraction_status:"needs_review",extracted_data:{...extracted,model:"gpt-5-mini",extracted_at:new Date().toISOString()}}).eq("id",doc.id);
    revalidatePath("/app/documents");
    return{status:"success",message:"Extraction ready for review."};
  }catch(error){
    const message=error instanceof Error?error.message:"Document extraction failed.";
    await supabase.from("documents").update({extraction_status:"failed",extracted_data:{error:message,failed_at:new Date().toISOString()}}).eq("id",doc.id);
    revalidatePath("/app/documents");
    return{status:"error",message};
  }
}
