"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { assertUsageAvailable, billingLimitMessage } from "@/lib/billing";
import { extractBankStatementPdf } from "@/lib/openai-bookkeeping";
import { runAiTransactionPipeline } from "@/lib/ai-transaction-pipeline";
import { canBookkeep } from "@/lib/permissions";
import { assertActionRateLimit, localizedRateLimitMessage, SecurityRateLimitError } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { userFacingDataError } from "@/lib/user-facing-error";

export type BankImportState={status:"idle"|"success"|"error";message:string;imported?:number;duplicates?:number;aiAutoPosted?:number;aiRemaining?:number;documentSaved?:boolean};
type NormalizedRow={booking_date:string;value_date?:string|null;amount:number;currency?:string;counterparty_name?:string|null;counterparty_iban?:string|null;counterparty_address?:string|null;reference?:string|null;communication?:string|null;operation_code?:string|null;external_id?:string|null;raw_details?:string|null;source_page?:number|null;source_format?:string|null};
function refresh(){for(const p of ["/app","/app/banking","/app/transactions","/app/accounting","/app/documents","/app/vat","/app/taxes","/app/reports","/app/year-end","/app/settings/usage"])revalidatePath(p)}
function normalizeIban(value:string){return value.trim().toUpperCase().replace(/^IBAN[:\s-]*/,"").replace(/\s+/g,"")}
function safeName(name:string){const parts=name.split("."),ext=parts.length>1?`.${parts.pop()?.toLowerCase().replace(/[^a-z0-9]/g,"")}`:"";const base=parts.join(".").normalize("NFKD").replace(/[^a-zA-Z0-9-_]+/g,"-").replace(/^-+|-+$/g,"").slice(0,90)||"bank-statement";return`${base}${ext}`}
function key(date:string,amount:number,currency:string){return`${date}|${Number(amount).toFixed(2)}|${currency.toUpperCase()}`}
function multiset<T>(items:T[],fn:(item:T)=>string){const m=new Map<string,number>();for(const item of items){const k=fn(item);m.set(k,(m.get(k)??0)+1)}return m}
function equalSets(a:Map<string,number>,b:Map<string,number>){if(a.size!==b.size)return false;for(const[k,v]of a)if(b.get(k)!==v)return false;return true}
async function findDuplicateBatch(supabase:Awaited<ReturnType<typeof createClient>>,companyId:string,rows:NormalizedRow[],fallbackCurrency:string){if(!rows.length)return null;const{data:batches}=await supabase.from("bank_import_batches").select("id,row_count,imported_count,file_name").eq("company_id",companyId).eq("row_count",rows.length).order("created_at",{ascending:false}).limit(60);if(!batches?.length)return null;const ids=batches.map(b=>b.id),{data:existing}=await supabase.from("bank_transactions").select("import_batch_id,booking_date,amount,currency").in("import_batch_id",ids).neq("match_status","ignored");if(!existing?.length)return null;const incoming=multiset(rows,r=>key(r.booking_date,r.amount,r.currency||fallbackCurrency));for(const batch of batches){const batchRows=existing.filter(r=>r.import_batch_id===batch.id);if(batchRows.length!==rows.length)continue;const seen=multiset(batchRows,r=>key(r.booking_date,Number(r.amount),r.currency||fallbackCurrency));if(equalSets(incoming,seen))return batch}return null}
async function archiveStatement(args:{supabase:Awaited<ReturnType<typeof createClient>>;file:File;organizationId:string;companyId:string;userId:string|null;batchId:string|null;imported:number;duplicates:number;bank:string|null}){const{file,supabase}=args;if(!file.size)return false;try{const bytes=Buffer.from(await file.arrayBuffer()),sha=createHash("sha256").update(bytes).digest("hex"),{data:existing}=await supabase.from("documents").select("id").eq("company_id",args.companyId).eq("sha256",sha).limit(1).maybeSingle();if(existing)return false;const year=new Date().getUTCFullYear(),path=`${args.organizationId}/${args.companyId}/${year}/bank-${randomUUID()}-${safeName(file.name)}`;const{error:storageError}=await supabase.storage.from("company-documents").upload(path,bytes,{contentType:file.type||"application/octet-stream",upsert:false,cacheControl:"3600"});if(storageError)throw storageError;const{error}=await supabase.from("documents").insert({organization_id:args.organizationId,company_id:args.companyId,type:"bank_statement",storage_path:path,file_name:file.name,mime_type:file.type||null,file_size:file.size,sha256:sha,extraction_status:"complete",extracted_data:{source:"banking_import",bank_import_batch_id:args.batchId,imported_count:args.imported,duplicate_count:args.duplicates,detected_bank:args.bank},created_by:args.userId});if(error){await supabase.storage.from("company-documents").remove([path]);throw error}return true}catch{return false}}

function scheduleBankClassification(args:{batchId:string;company:NonNullable<Awaited<ReturnType<typeof getWorkspace>>["company"]>}){
 if(!process.env.OPENAI_API_KEY)return;
 after(async()=>{
  try{
   const supabase=await createClient();
   const{data:bankRows}=await supabase.from("bank_transactions").select("id").eq("import_batch_id",args.batchId);
   const bankIds=(bankRows??[]).map(r=>r.id);
   if(!bankIds.length)return;
   const{data:sources}=await supabase.from("source_transactions").select("id").eq("company_id",args.company.id).eq("source_type","bank").in("source_id",bankIds);
   const ids=(sources??[]).map(s=>s.id);
   if(!ids.length)return;
   await runAiTransactionPipeline({supabase,company:args.company,sourceIds:ids,maxTransactions:250});
   refresh();
  }catch(error){
   console.error("Background bank classification failed",error);
  }
 });
}

export async function importBankRows(_previous:BankImportState,formData:FormData):Promise<BankImportState>{
 const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company||!workspace.organization)return{status:"error",message:"Your session expired. Please sign in again."};
 if(!canBookkeep(workspace.role))return{status:"error",message:"You do not have permission to import bank statements."};
 const locale=workspace.profile?.locale==="fr"?"fr":"en",accountName=String(formData.get("account_name")??"").trim(),iban=normalizeIban(String(formData.get("iban")??"")),currency=String(formData.get("currency")??workspace.company.base_currency??"EUR").trim().toUpperCase(),fileName=String(formData.get("file_name")??"bank-import.csv").trim(),detectedBank=String(formData.get("detected_bank")??"").trim()||null,statement=formData.get("statement_file"),isStatement=statement instanceof File&&statement.size>0,isPdf=isStatement&&(statement.type==="application/pdf"||/\.pdf$/i.test(statement.name));
 if(!accountName&&!iban)return{status:"error",message:"Give this bank account a name or enter its IBAN."};if(!/^[A-Z]{3}$/.test(currency))return{status:"error",message:"Use a three-letter currency such as EUR."};
 const supabase=await createClient();try{await assertActionRateLimit(supabase,"bank_import")}catch(error){return{status:"error",message:error instanceof SecurityRateLimitError?localizedRateLimitMessage(locale,error.retryAfterSeconds):"The security check could not be completed. Please try again."}}
 let rows:NormalizedRow[]=[];try{if(isPdf){const extracted=await extractBankStatementPdf(statement,workspace.company);rows=extracted.transactions.map(r=>({...r,counterparty_iban:r.counterparty_iban?normalizeIban(r.counterparty_iban):r.counterparty_iban,source_format:"pdf_ai"}));if(!iban&&extracted.account_iban)formData.set("iban",normalizeIban(extracted.account_iban));if((!accountName||accountName==="Main bank account")&&extracted.account_name)formData.set("account_name",extracted.account_name)}else{const parsed=JSON.parse(String(formData.get("rows_json")??"[]"));if(Array.isArray(parsed))rows=parsed.map(r=>({...r,counterparty_iban:r.counterparty_iban?normalizeIban(String(r.counterparty_iban)):r.counterparty_iban,source_format:/\.xlsx$/i.test(fileName)?"xlsx":"csv"}))}}catch(error){return{status:"error",message:userFacingDataError(error,"Zuelen could not read this statement.")}}
 if(!rows.length)return{status:"error",message:"No valid bank movements were found in this statement."};if(rows.length>2500)return{status:"error",message:"Import up to 2,500 bank rows at a time."};
 const effectiveIban=normalizeIban(String(formData.get("iban")??iban)),effectiveName=String(formData.get("account_name")??accountName).trim()||accountName||"Main bank account",duplicateBatch=await findDuplicateBatch(supabase,workspace.company.id,rows,currency);
 if(duplicateBatch){const documentSaved=isStatement?await archiveStatement({supabase,file:statement,organizationId:workspace.organization.id,companyId:workspace.company.id,userId:workspace.userId,batchId:duplicateBatch.id,imported:0,duplicates:rows.length,bank:detectedBank}):false;refresh();return{status:"success",message:`This statement is already in Zuelen (${duplicateBatch.file_name||"existing batch"}). ${rows.length} duplicate movement${rows.length===1?"":"s"} skipped — nothing was posted twice${documentSaved?" · original statement archived in Documents":""}.`,imported:0,duplicates:rows.length,documentSaved}}
 try{await assertUsageAvailable(workspace.organization.id,"bank_imports",1);await assertUsageAvailable(workspace.organization.id,"transactions",rows.length)}catch(error){return{status:"error",message:billingLimitMessage(error,locale)??(userFacingDataError(error,"Your Basic allowance has been reached."))}}
 const{data,error}=await supabase.rpc("import_bank_rows",{p_company_id:workspace.company.id,p_account_name:effectiveName,p_iban:effectiveIban||null,p_currency:currency,p_file_name:fileName||null,p_rows:rows});if(error){const friendly=billingLimitMessage(new Error(error.message),locale);return{status:"error",message:friendly??userFacingDataError(error)}}const result=data&&typeof data==="object"?data as Record<string,unknown>:{},imported=Number(result.imported??0),duplicates=Number(result.duplicates??0),batchId=typeof result.batch_id==="string"?result.batch_id:null;
 const documentSaved=isStatement?await archiveStatement({supabase,file:statement,organizationId:workspace.organization.id,companyId:workspace.company.id,userId:workspace.userId,batchId,imported,duplicates,bank:detectedBank}):false;
 if(imported>0&&batchId)scheduleBankClassification({batchId,company:workspace.company});
 refresh();return{status:"success",message:`${imported} bank movement${imported===1?"":"s"} imported${duplicates?` · ${duplicates} duplicate${duplicates===1?"":"s"} skipped`:""}${documentSaved?" · statement saved in Documents":""}.`,imported,duplicates,documentSaved};
}
