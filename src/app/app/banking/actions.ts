"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { extractBankStatementPdf } from "@/lib/openai-bookkeeping";
import { runAiTransactionPipeline } from "@/lib/ai-transaction-pipeline";

export type BankImportState={status:"idle"|"success"|"error";message:string;imported?:number;duplicates?:number;aiAutoPosted?:number;aiRemaining?:number};
function refresh(){for(const path of ["/app","/app/banking","/app/transactions","/app/accounting","/app/reports","/app/vat","/app/year-end"])revalidatePath(path)}

export async function importBankRows(_previous:BankImportState,formData:FormData):Promise<BankImportState>{
 const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again."};
 let accountName=String(formData.get("account_name")??"").trim(),iban=String(formData.get("iban")??"").trim().replace(/\s+/g,"").toUpperCase(),currency=String(formData.get("currency")??workspace.company.base_currency??"EUR").trim().toUpperCase(),fileName=String(formData.get("file_name")??"bank-import.csv").trim();
 const uploaded=formData.get("statement_file"),isFile=uploaded instanceof File&&uploaded.size>0,isPdf=isFile&&(uploaded.type==="application/pdf"||/\.pdf$/i.test(uploaded.name));let rows:unknown=[];let usedPdfAi=false;
 if(!/^[A-Z]{3}$/.test(currency))return{status:"error",message:"Use a three-letter currency such as EUR."};
 if(isPdf){try{const extracted=await extractBankStatementPdf(uploaded,workspace.company);rows=extracted.transactions.map(row=>({...row,currency:(row.currency||extracted.currency||currency).toUpperCase(),statement_bank:extracted.bank_name,statement_account_iban:extracted.account_iban,source_format:"pdf_ai"}));fileName=uploaded.name||fileName;iban=iban||String(extracted.account_iban??"").replace(/\s+/g,"").toUpperCase();if(!accountName||accountName==="Main bank account")accountName=extracted.account_name||`${extracted.bank_name||"Bank"} account`;usedPdfAi=true}catch(error){return{status:"error",message:error instanceof Error?error.message:"Compta could not interpret this PDF bank statement."}}}
 else{const rowsJson=String(formData.get("rows_json")??"[]");try{rows=JSON.parse(rowsJson)}catch{return{status:"error",message:"The normalized statement rows could not be read."}}}
 if(!accountName&&!iban)return{status:"error",message:"Give this bank account a name or enter its IBAN."};if(!Array.isArray(rows)||rows.length===0)return{status:"error",message:isPdf?"No account movements were found in this PDF.":"No valid bank rows were found in this file."};if(rows.length>2500)return{status:"error",message:"Import up to 2,500 bank rows at a time."};
 const supabase=await createClient();const{data,error}=await supabase.rpc("import_bank_rows",{p_company_id:workspace.company.id,p_account_name:accountName||"Main bank account",p_iban:iban||null,p_currency:currency,p_file_name:fileName||null,p_rows:rows});if(error)return{status:"error",message:error.message};const result=data&&typeof data==="object"?data as Record<string,unknown>:{};const imported=Number(result.imported??0),duplicates=Number(result.duplicates??0),batchId=typeof result.batch_id==="string"?result.batch_id:null;
 let aiAutoPosted=0,aiRemaining=0,aiNote="";
 if(imported>0&&process.env.OPENAI_API_KEY&&batchId){try{const{data:bankRows}=await supabase.from("bank_transactions").select("id").eq("company_id",workspace.company.id).eq("import_batch_id",batchId);const sourceIds=(bankRows??[]).map(row=>String(row.id));if(sourceIds.length){const ai=await runAiTransactionPipeline({supabase,company:workspace.company,sourceIds,maxTransactions:Math.min(220,sourceIds.length)});aiAutoPosted=ai.ai_auto_posted+ai.deterministic_posted;aiRemaining=ai.remaining;aiNote=` · ${aiAutoPosted} high-confidence movement${aiAutoPosted===1?"":"s"} posted automatically${aiRemaining?` · ${aiRemaining} left for review`:""}`}}catch(error){aiNote=` · imported successfully; AI classification will be available from Transactions (${error instanceof Error?error.message:"AI pass unavailable"})`}}
 refresh();return{status:"success",message:`${imported} bank transaction${imported===1?"":"s"} imported${duplicates?` · ${duplicates} duplicate${duplicates===1?"":"s"} skipped`:""}${usedPdfAi?" · PDF read with AI":""}${aiNote}.`,imported,duplicates,aiAutoPosted,aiRemaining};
}
