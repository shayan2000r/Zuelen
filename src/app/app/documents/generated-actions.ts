"use server";

import { revalidatePath } from "next/cache";
import { fiscalYearBounds } from "@/lib/fiscal-year";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export type GeneratedDocumentState={status:"idle"|"success"|"error";message:string;documentId?:string};
const REPORTS={profit_loss:"Profit & Loss",balance_sheet:"Balance Sheet",trial_balance:"Trial Balance",pcn:"PCN Closing Balances",annual_accounts:"Annual Accounts",annexe:"Annexe to the Annual Accounts",general_ledger:"General Ledger",general_journal:"General Journal"} as const;
type ReportType=keyof typeof REPORTS;
const GENERATOR_VERSION="2026.3";
function validType(value:string):value is ReportType{return Object.prototype.hasOwnProperty.call(REPORTS,value)}
function asObject(value:unknown){return value&&typeof value==="object"?value as Record<string,unknown>:null}
function validUuid(value:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)}

export async function generateFinancialDocumentAction(_previous:GeneratedDocumentState,formData:FormData):Promise<GeneratedDocumentState>{
 const workspace=await getWorkspace();
 if(!workspace.authenticated||!workspace.userId||!workspace.company||!workspace.organization)return{status:"error",message:"Your session expired. Please sign in again."};
 const fiscalYear=Number(formData.get("fiscal_year")),documentType=String(formData.get("document_type")??"");
 if(!Number.isInteger(fiscalYear)||fiscalYear<2000||fiscalYear>2100)return{status:"error",message:"Choose a valid financial year."};
 if(!validType(documentType))return{status:"error",message:"Choose a supported financial document."};
 const bounds=fiscalYearBounds(fiscalYear,workspace.company.fiscal_year_start_month),supabase=await createClient();
 const{data:filing,error:filingError}=await supabase.from("filings").select("id,period_label,status,rules_version,ledger_snapshot,snapshot_at,ledger_checksum,period_start,period_end").eq("company_id",workspace.company.id).eq("filing_type","ecdf_accounts").eq("period_label",String(fiscalYear)).order("snapshot_at",{ascending:false}).limit(1).maybeSingle();
 if(filingError)return{status:"error",message:filingError.message};
 if(!filing?.ledger_snapshot)return{status:"error",message:`${fiscalYear} has no closing snapshot. Create the closing snapshot first.`};
 const{data:period,error:periodError}=await supabase.from("accounting_periods").select("status,locked_at").eq("company_id",workspace.company.id).eq("starts_on",filing.period_start||bounds.start).eq("ends_on",filing.period_end||bounds.end).maybeSingle();
 if(periodError)return{status:"error",message:periodError.message};
 if(!period||!["soft_closed","hard_closed"].includes(period.status))return{status:"error",message:`${fiscalYear} must be closed before generating frozen financial documents.`};
 const snapshot=asObject(filing.ledger_snapshot);if(!snapshot)return{status:"error",message:"The closing snapshot is unreadable."};
 const payload:Record<string,unknown>={
  company:{legal_name:workspace.company.legal_name,trading_name:workspace.company.trading_name,legal_form:workspace.company.legal_form,rcs_number:workspace.company.rcs_number,vat_number:workspace.company.vat_number,tax_number:workspace.company.tax_number,registered_address:workspace.company.registered_address,brand_image_path:workspace.company.brand_image_path,base_currency:workspace.company.base_currency||"EUR"},
  fiscal_year:fiscalYear,period_start:filing.period_start||bounds.start,period_end:filing.period_end||bounds.end,snapshot_at:filing.snapshot_at,generated_at:new Date().toISOString(),ledger_checksum:filing.ledger_checksum,rules_version:filing.rules_version,period_status:period.status,ledger_snapshot:snapshot
 };
 if(documentType==="general_ledger"||documentType==="general_journal"){
  const entriesRaw=Array.isArray(snapshot.entries)?snapshot.entries:[],entryIds=entriesRaw.map(item=>asObject(item)?.id).filter((id):id is string=>typeof id==="string");
  if(entryIds.length){
   const[entriesResult,linesResult,accountsResult]=await Promise.all([
    supabase.from("journal_entries").select("id,entry_number,entry_date,description,source_type").in("id",entryIds),
    supabase.from("journal_lines").select("journal_entry_id,company_account_id,description,debit,credit,currency,created_at").in("journal_entry_id",entryIds),
    supabase.from("company_accounts").select("id,code,label,account_type").eq("company_id",workspace.company.id)
   ]);
   if(entriesResult.error||linesResult.error||accountsResult.error)return{status:"error",message:"Compta could not freeze the journal detail required for this report."};
   const accountMap=new Map((accountsResult.data??[]).map(account=>[account.id,account])),linesByEntry=new Map<string,Record<string,unknown>[]>();
   for(const line of linesResult.data??[]){const account=accountMap.get(line.company_account_id),lineRows=linesByEntry.get(line.journal_entry_id)??[];lineRows.push({account_code:account?.code??"",account_label:account?.label??line.description??"Account",account_type:account?.account_type??"",description:line.description,debit:Number(line.debit),credit:Number(line.credit),currency:line.currency,created_at:line.created_at});linesByEntry.set(line.journal_entry_id,lineRows)}
   const entries=(entriesResult.data??[]).map(entry=>({id:entry.id,entry_number:entry.entry_number,entry_date:entry.entry_date,description:entry.description,source_type:entry.source_type,lines:linesByEntry.get(entry.id)??[]})).sort((a,b)=>String(a.entry_date).localeCompare(String(b.entry_date))||Number(a.entry_number)-Number(b.entry_number));
   payload.journal={entries};
  }else payload.journal={entries:[]};
 }
 const title=`${REPORTS[documentType]} · ${fiscalYear}`;
 const{data:generated,error}=await supabase.from("generated_documents").insert({organization_id:workspace.organization.id,company_id:workspace.company.id,filing_id:filing.id,fiscal_year:fiscalYear,document_type:documentType,title,generator_version:GENERATOR_VERSION,payload,created_by:workspace.userId}).select("id").single();
 if(error||!generated)return{status:"error",message:error?.message??"The financial document could not be generated."};
 revalidatePath("/app/documents");revalidatePath("/app/ecdf");
 return{status:"success",message:`${REPORTS[documentType]} generated from the frozen ${fiscalYear} snapshot.`,documentId:generated.id};
}

export async function deleteGeneratedFinancialDocumentAction(formData:FormData):Promise<void>{
 const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)throw new Error("Your session expired. Please sign in again.");
 const id=String(formData.get("document_id")??"");if(!validUuid(id))throw new Error("Invalid generated document.");
 const supabase=await createClient(),{error}=await supabase.from("generated_documents").delete().eq("company_id",workspace.company.id).eq("id",id);
 if(error)throw new Error(error.message);
 revalidatePath("/app/documents");
}
