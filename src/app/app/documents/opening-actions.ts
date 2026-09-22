"use server";

import { revalidatePath } from "next/cache";
import { getActiveFiscalYear } from "@/lib/fiscal-year";
import { canBookkeep } from "@/lib/permissions";
import { assertActionRateLimit, localizedRateLimitMessage, SecurityRateLimitError } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { userFacingDataError } from "@/lib/user-facing-error";

export type OpeningImportState={
 status:"idle"|"success"|"error";
 message:string;
 sourceYear?:number|null;
 targetYear?:number|null;
 lineCount?:number;
};

type ExtractedLine={code:string;label:string;debit:number;credit:number;confidence:number};
type ExtractedOpening={
 document_kind:string;
 entity_name:string|null;
 source_fiscal_year:number|null;
 period_end:string|null;
 currency:string|null;
 lines:ExtractedLine[];
 financial_year_result:{debit:number;credit:number;confidence:number};
 confidence:number;
 notes:string;
};

const openingSchema={
 type:"object",
 additionalProperties:false,
 required:["document_kind","entity_name","source_fiscal_year","period_end","currency","lines","financial_year_result","confidence","notes"],
 properties:{
  document_kind:{type:"string",enum:["pcn","annual_accounts","balance_sheet","trial_balance","other"]},
  entity_name:{type:["string","null"]},
  source_fiscal_year:{type:["integer","null"]},
  period_end:{type:["string","null"]},
  currency:{type:["string","null"]},
  lines:{type:"array",items:{
   type:"object",additionalProperties:false,
   required:["code","label","debit","credit","confidence"],
   properties:{code:{type:"string"},label:{type:"string"},debit:{type:"number"},credit:{type:"number"},confidence:{type:"number",minimum:0,maximum:1}}
  }},
  financial_year_result:{
   type:"object",additionalProperties:false,
   required:["debit","credit","confidence"],
   properties:{debit:{type:"number"},credit:{type:"number"},confidence:{type:"number",minimum:0,maximum:1}}
  },
  confidence:{type:"number",minimum:0,maximum:1},
  notes:{type:"string"}
 }
} as const;

function validUuid(value:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)}
function outputText(payload:unknown){if(!payload||typeof payload!=="object")return null;const output=(payload as{output?:unknown[]}).output;if(!Array.isArray(output))return null;for(const item of output){if(!item||typeof item!=="object")continue;const content=(item as{content?:unknown[]}).content;if(!Array.isArray(content))continue;for(const part of content){if(part&&typeof part==="object"&&(part as{type?:string}).type==="output_text"){const text=(part as{text?:unknown}).text;if(typeof text==="string")return text}}}return null}
function round2(value:unknown){const n=Number(value);return Number.isFinite(n)?Math.round(n*100)/100:0}
function refresh(){for(const path of ["/app","/app/accounting","/app/documents","/app/reports","/app/year-end","/app/ecdf","/app/taxes","/app/vat"])revalidatePath(path)}

export async function processOpeningDocumentAction(_previous:OpeningImportState,formData:FormData):Promise<OpeningImportState>{
 const workspace=await getWorkspace();
 if(!workspace.authenticated||!workspace.company||!workspace.organization)return{status:"error",message:"Your session expired. Please sign in again."};
 if(!canBookkeep(workspace.role))return{status:"error",message:"You do not have permission to import an opening position."};
 const documentId=String(formData.get("document_id")??"").trim();if(!validUuid(documentId))return{status:"error",message:"Invalid document reference."};
 const apiKey=process.env.OPENAI_API_KEY;if(!apiKey)return{status:"error",message:"AI document extraction is not configured on this deployment yet."};
 const locale=workspace.profile?.locale==="fr"?"fr":"en",targetYear=await getActiveFiscalYear(workspace.company.fiscal_year_start_month),expectedSourceYear=targetYear-1,supabase=await createClient();
 try{await assertActionRateLimit(supabase,"document_extract")}catch(error){return{status:"error",message:error instanceof SecurityRateLimitError?localizedRateLimitMessage(locale,error.retryAfterSeconds):"The security check could not be completed. Please try again.",targetYear}}
 const{data:doc,error:docError}=await supabase.from("documents").select("id,company_id,file_name,mime_type,file_size,storage_path").eq("id",documentId).eq("company_id",workspace.company.id).maybeSingle();
 if(docError||!doc)return{status:"error",message:docError?userFacingDataError(docError,"Opening document not found.",locale):"Opening document not found.",targetYear};
 const mime=doc.mime_type??"";if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(mime))return{status:"error",message:"Opening-position extraction currently supports PDF, JPG, PNG and WebP documents.",targetYear};
 if(Number(doc.file_size??0)>12*1024*1024)return{status:"error",message:"AI extraction currently supports opening documents up to 12 MB.",targetYear};
 await supabase.from("documents").update({extraction_status:"processing"}).eq("id",doc.id);
 try{
  const{data:file,error:fileError}=await supabase.storage.from("company-documents").download(doc.storage_path);if(fileError||!file)throw new Error(fileError?.message??"Could not read the private document.");
  const bytes=Buffer.from(await file.arrayBuffer()),base64=bytes.toString("base64"),filePart=mime.startsWith("image/")?{type:"input_image",image_url:`data:${mime};base64,${base64}`,detail:"high"}:{type:"input_file",filename:doc.file_name,file_data:`data:${mime};base64,${base64}`};
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-5-mini",store:false,max_output_tokens:5000,input:[{role:"developer",content:[{type:"input_text",text:`You extract opening-position facts for a Luxembourg accounting application. The target company is ${workspace.company.legal_name}. Read only facts visible in the uploaded accounting document. The target financial year is ${targetYear}, therefore the expected prior closing year is ${expectedSourceYear}. Extract the printed source financial year and period end; never change them to match the target. Extract only NON-ZERO CLOSING BALANCE-SHEET balances that carry forward into the next year. For a Luxembourg PCN, put classes 1 to 5 only in lines and exclude classes 6 and 7, report totals, headings and statistical fields. Return only the most granular non-zero PCN account visible: when both a parent aggregate and one or more non-zero descendants are printed, omit the parent aggregate so balances are not duplicated. Preserve the printed debit/credit side exactly. Separately read the clearly printed financial-year result / “Résultat de l'exercice”, when present, into financial_year_result. Do NOT include that result as a normal lines item and do not derive it from the balance-sheet difference. Preserve its printed debit/credit side. If no reliable printed result is visible, return debit 0, credit 0 and confidence 0 for financial_year_result. Never invent a PCN code, amount, account side, result or year. If the document is not suitable for an opening position, return an empty lines array and explain why in notes.`}]},{role:"user",content:[{type:"input_text",text:"Extract the prior-year closing balance-sheet position for deterministic opening-balance posting."},filePart]}],text:{format:{type:"json_schema",name:"zuelen_opening_position",strict:true,schema:openingSchema}}})});
  const payload=await response.json();if(!response.ok){console.error("OpenAI opening extraction failed",response.status);throw new Error("The opening-position extraction service is temporarily unavailable.")}
  const text=outputText(payload);if(!text)throw new Error("The extraction model returned no structured opening-position result.");
  const extracted=JSON.parse(text) as ExtractedOpening;
  const sourceYear=Number.isInteger(extracted.source_fiscal_year)?extracted.source_fiscal_year:null;
  if(sourceYear!==expectedSourceYear){await supabase.from("documents").update({extraction_status:"needs_review",extracted_data:{...extracted,opening_import_status:"year_mismatch",target_fiscal_year:targetYear,expected_source_year:expectedSourceYear,model:"gpt-5-mini",extracted_at:new Date().toISOString()}}).eq("id",doc.id);refresh();return{status:"error",sourceYear,targetYear,message:sourceYear?`This document is for financial year ${sourceYear}, but the opening position for ${targetYear} must come from ${expectedSourceYear}. Nothing was posted.`:`Zuelen could not verify the source financial year. Nothing was posted. Upload the ${expectedSourceYear} PCN or annual accounts.`}}
  const raw=extracted.lines.map(line=>({code:String(line.code??"").trim().replace(/[^0-9]/g,""),label:String(line.label??"").trim(),debit:round2(line.debit),credit:round2(line.credit),confidence:Number(line.confidence)||0})).filter(line=>line.code&&(line.debit>0||line.credit>0));
  if(raw.length<2)throw new Error("Zuelen could not extract at least two non-zero balance-sheet accounts from this document.");
  if(raw.some(line=>line.debit<0||line.credit<0||(line.debit>0&&line.credit>0)))throw new Error("The extracted opening position contains an invalid debit/credit line.");
  const duplicates=[...new Set(raw.map(line=>line.code).filter((code,index,codes)=>codes.indexOf(code)!==index))];if(duplicates.length)throw new Error(`The extracted PCN contains duplicate account codes (${duplicates.join(", ")}). Nothing was posted.`);
  const clean=raw.filter(line=>!raw.some(other=>other.code!==line.code&&other.code.startsWith(line.code)));
  if(clean.length<2)throw new Error("Zuelen could not isolate a complete leaf-level PCN opening position.");
  const overallConfidence=Number(extracted.confidence)||0,lowestLineConfidence=Math.min(...clean.map(line=>line.confidence));
  if(overallConfidence<.85||lowestLineConfidence<.8){await supabase.from("documents").update({extraction_status:"needs_review",extracted_data:{...extracted,opening_import_status:"low_confidence",target_fiscal_year:targetYear,leaf_codes:clean.map(line=>line.code),model:"gpt-5-mini",extracted_at:new Date().toISOString()}}).eq("id",doc.id);refresh();return{status:"error",sourceYear,targetYear,lineCount:clean.length,message:"Zuelen read the opening document, but extraction confidence is not high enough to post financial balances automatically. Nothing was posted."}}

  const baseDebit=round2(clean.reduce((sum,line)=>sum+line.debit,0)),baseCredit=round2(clean.reduce((sum,line)=>sum+line.credit,0)),baseDifference=round2(baseDebit-baseCredit);
  let openingLines=[...clean];
  let resultReconciliation:{applied:boolean;code:string;debit:number;credit:number;confidence:number}={applied:false,code:"142",debit:0,credit:0,confidence:0};
  if(Math.abs(baseDifference)>.005){
   const resultDebit=round2(extracted.financial_year_result?.debit),resultCredit=round2(extracted.financial_year_result?.credit),resultConfidence=Number(extracted.financial_year_result?.confidence)||0;
   const validSides=resultDebit>=0&&resultCredit>=0&&((resultDebit>0&&resultCredit===0)||(resultCredit>0&&resultDebit===0));
   const matches=baseDifference>0?resultDebit===0&&Math.abs(resultCredit-baseDifference)<=.01:resultCredit===0&&Math.abs(resultDebit-Math.abs(baseDifference))<=.01;
   if(!validSides||resultConfidence<.8||!matches){await supabase.from("documents").update({extraction_status:"needs_review",extracted_data:{...extracted,opening_import_status:"unbalanced",target_fiscal_year:targetYear,total_debit:baseDebit,total_credit:baseCredit,financial_year_result:{debit:resultDebit,credit:resultCredit,confidence:resultConfidence},result_reconciliation:{applied:false,expected_difference:Math.abs(baseDifference)},leaf_codes:clean.map(line=>line.code),model:"gpt-5-mini",extracted_at:new Date().toISOString()}}).eq("id",doc.id);refresh();return{status:"error",sourceYear,targetYear,lineCount:clean.length,message:`Zuelen extracted ${clean.length} balance-sheet accounts, but the position does not balance (${baseDebit.toFixed(2)} debit / ${baseCredit.toFixed(2)} credit) and the printed financial-year result could not reconcile it exactly. Nothing was posted.`}}
   if(clean.some(line=>line.code==="142"))throw new Error("The extracted PCN contains account 142 as a balance line and also requires result reconciliation. Nothing was posted.");
   resultReconciliation={applied:true,code:"142",debit:resultDebit,credit:resultCredit,confidence:resultConfidence};
   openingLines=[...clean,{code:"142",label:"Résultat de l'exercice",debit:resultDebit,credit:resultCredit,confidence:resultConfidence}];
  }

  const codes=openingLines.map(line=>line.code),{data:master,error:masterError}=await supabase.from("pcn_accounts").select("id,code,label_en,label_fr,account_type").eq("source_version","PCN2020").eq("is_active",true).in("code",codes);if(masterError)throw new Error(userFacingDataError(masterError));
  const masterMap=new Map((master??[]).map(account=>[account.code,account])),unsupported=codes.filter(code=>!masterMap.has(code));
  if(unsupported.length){await supabase.from("documents").update({extraction_status:"needs_review",extracted_data:{...extracted,opening_import_status:"unsupported_accounts",unsupported_codes:unsupported,target_fiscal_year:targetYear,leaf_codes:openingLines.map(line=>line.code),result_reconciliation:resultReconciliation,model:"gpt-5-mini",extracted_at:new Date().toISOString()}}).eq("id",doc.id);refresh();return{status:"error",sourceYear,targetYear,message:`Zuelen extracted the PCN, but ${unsupported.length} account${unsupported.length===1?" is":"s are"} not yet supported (${unsupported.join(", ")}). Nothing was posted.`}}
  const invalidMaster=(master??[]).filter(account=>!["asset","liability","equity"].includes(account.account_type));if(invalidMaster.length)throw new Error("The extracted document includes non-balance-sheet PCN accounts. Nothing was posted.");
  const{data:existing,error:existingError}=await supabase.from("company_accounts").select("id,code,is_active").eq("company_id",workspace.company.id).in("code",codes);if(existingError)throw new Error(userFacingDataError(existingError));
  const existingMap=new Map((existing??[]).map(account=>[account.code,account])),missing=(master??[]).filter(account=>!existingMap.has(account.code));
  if(missing.length){const{error:insertError}=await supabase.from("company_accounts").insert(missing.map(account=>({organization_id:workspace.organization!.id,company_id:workspace.company!.id,pcn_account_id:account.id,code:account.code,label:locale==="fr"?(account.label_fr||account.label_en):(account.label_en||account.label_fr),label_en:account.label_en,label_fr:account.label_fr,account_type:account.account_type,is_active:true})));if(insertError)throw new Error(userFacingDataError(insertError))}
  const inactive=(existing??[]).filter(account=>!account.is_active).map(account=>account.id);if(inactive.length){const{error:activateError}=await supabase.from("company_accounts").update({is_active:true}).in("id",inactive);if(activateError)throw new Error(userFacingDataError(activateError))}
  const{data:companyAccounts,error:companyError}=await supabase.from("company_accounts").select("id,code,account_type").eq("company_id",workspace.company.id).eq("is_active",true).in("code",codes);if(companyError)throw new Error(userFacingDataError(companyError));
  const companyMap=new Map((companyAccounts??[]).map(account=>[account.code,account])),posting=openingLines.map(line=>({account_id:companyMap.get(line.code)?.id,debit:line.debit,credit:line.credit}));if(posting.some(line=>!line.account_id))throw new Error("Zuelen could not map every extracted PCN account to the company ledger.");
  const totalDebit=round2(posting.reduce((sum,line)=>sum+line.debit,0)),totalCredit=round2(posting.reduce((sum,line)=>sum+line.credit,0));
  if(totalDebit<=0||Math.abs(totalDebit-totalCredit)>.005){await supabase.from("documents").update({extraction_status:"needs_review",extracted_data:{...extracted,opening_import_status:"unbalanced",target_fiscal_year:targetYear,total_debit:totalDebit,total_credit:totalCredit,result_reconciliation:resultReconciliation,leaf_codes:openingLines.map(line=>line.code),model:"gpt-5-mini",extracted_at:new Date().toISOString()}}).eq("id",doc.id);refresh();return{status:"error",sourceYear,targetYear,lineCount:openingLines.length,message:`Zuelen extracted ${openingLines.length} balance-sheet accounts, but the position does not balance (${totalDebit.toFixed(2)} debit / ${totalCredit.toFixed(2)} credit). Nothing was posted.`}}
  const{data:entryId,error:postError}=await supabase.rpc("save_opening_balance_entry",{p_company_id:workspace.company.id,p_fiscal_year:targetYear,p_lines:posting});if(postError)throw new Error(userFacingDataError(postError));
  const{error:completeError}=await supabase.from("documents").update({extraction_status:"complete",extracted_data:{...extracted,opening_import_status:"posted",opening_journal_entry_id:entryId,target_fiscal_year:targetYear,total_debit:totalDebit,total_credit:totalCredit,line_count:openingLines.length,leaf_codes:openingLines.map(line=>line.code),result_reconciliation:resultReconciliation,model:"gpt-5-mini",extracted_at:new Date().toISOString()}}).eq("id",doc.id);if(completeError)console.error("Opening document metadata update failed",completeError.message);
  refresh();return{status:"success",sourceYear,targetYear,lineCount:openingLines.length,message:`Your opening position has been added for financial year ${targetYear}. ${openingLines.length} PCN balance${openingLines.length===1?"":"s"} were extracted, validated and posted.`};
 }catch(error){const message=userFacingDataError(error,"Opening-position extraction failed.",locale);await supabase.from("documents").update({extraction_status:"failed",extracted_data:{error:message,opening_import_status:"failed",target_fiscal_year:targetYear,failed_at:new Date().toISOString()}}).eq("id",doc.id);refresh();return{status:"error",message,sourceYear:null,targetYear}}
}
