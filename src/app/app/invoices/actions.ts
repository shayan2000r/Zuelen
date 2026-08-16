"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export type InvoiceActionState = { status: "idle" | "success" | "error"; message: string; invoiceId: string | null };

type ParsedInvoice = {
  customerName:string; customerEmail:string; customerCountry:string; customerVat:string; issueDate:string; serviceDate:string; dueDate:string; vatTreatment:string; street:string; postalCode:string; city:string; notes:string; lines:unknown[];
};

function parseInvoice(formData: FormData): ParsedInvoice | { error: string } {
  const customerName=String(formData.get("customer_name")??"").trim();
  const customerEmail=String(formData.get("customer_email")??"").trim();
  const customerCountry=String(formData.get("customer_country")??"LU").trim().toUpperCase();
  const customerVat=String(formData.get("customer_vat_number")??"").trim();
  const issueDate=String(formData.get("issue_date")??"");
  const serviceDate=String(formData.get("service_date")??"");
  const dueDate=String(formData.get("due_date")??"");
  const vatTreatment=String(formData.get("vat_treatment")??"domestic");
  const street=String(formData.get("customer_street")??"").trim();
  const postalCode=String(formData.get("customer_postal_code")??"").trim();
  const city=String(formData.get("customer_city")??"").trim();
  const notes=String(formData.get("notes")??"").trim();
  if(!customerName||!street||!postalCode||!city)return{error:"Customer name and full billing address are required."};
  if(!/^[A-Z]{2}$/.test(customerCountry))return{error:"Use a two-letter country code such as LU, FR or DE."};
  if(![issueDate,serviceDate,dueDate].every(value=>/^\d{4}-\d{2}-\d{2}$/.test(value)))return{error:"Invoice, service and due dates are required."};
  if(!["domestic","eu_b2b_reverse_charge"].includes(vatTreatment))return{error:"Unsupported VAT treatment."};
  let lines:unknown;
  try{lines=JSON.parse(String(formData.get("lines_json")??"[]"));}catch{return{error:"The invoice lines could not be read."};}
  if(!Array.isArray(lines)||lines.length===0)return{error:"Add at least one invoice line."};
  return{customerName,customerEmail,customerCountry,customerVat,issueDate,serviceDate,dueDate,vatTreatment,street,postalCode,city,notes,lines};
}

export async function createAndIssueInvoice(_previous:InvoiceActionState,formData:FormData):Promise<InvoiceActionState>{
  const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again.",invoiceId:null};
  const parsed=parseInvoice(formData);if("error" in parsed)return{status:"error",message:parsed.error,invoiceId:null};
  const supabase=await createClient();
  const{data,error}=await supabase.rpc("create_and_issue_service_invoice",{p_company_id:workspace.company.id,p_customer_name:parsed.customerName,p_customer_email:parsed.customerEmail||null,p_customer_country:parsed.customerCountry,p_customer_vat_number:parsed.customerVat||null,p_customer_address:{street:parsed.street,postal_code:parsed.postalCode,city:parsed.city,country_code:parsed.customerCountry},p_issue_date:parsed.issueDate,p_service_date:parsed.serviceDate,p_due_date:parsed.dueDate,p_vat_treatment:parsed.vatTreatment,p_lines:parsed.lines,p_notes:parsed.notes||null});
  if(error)return{status:"error",message:error.message,invoiceId:null};const invoiceId=typeof data==="string"?data:null;if(!invoiceId)return{status:"error",message:"The invoice was created but no invoice ID was returned.",invoiceId:null};
  revalidatePath("/app");revalidatePath("/app/invoices");revalidatePath("/app/accounting");revalidatePath("/app/taxes");return{status:"success",message:"Invoice issued and posted to the ledger.",invoiceId};
}

export async function correctAndReissueInvoice(_previous:InvoiceActionState,formData:FormData):Promise<InvoiceActionState>{
  const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again.",invoiceId:null};
  const originalId=String(formData.get("original_invoice_id")??"");if(!/^[0-9a-f-]{36}$/i.test(originalId))return{status:"error",message:"Invalid original invoice.",invoiceId:null};
  const parsed=parseInvoice(formData);if("error" in parsed)return{status:"error",message:parsed.error,invoiceId:null};
  const supabase=await createClient();
  const{data,error}=await supabase.rpc("correct_and_reissue_service_invoice",{p_invoice_id:originalId,p_customer_name:parsed.customerName,p_customer_email:parsed.customerEmail||null,p_customer_country:parsed.customerCountry,p_customer_vat_number:parsed.customerVat||null,p_customer_address:{street:parsed.street,postal_code:parsed.postalCode,city:parsed.city,country_code:parsed.customerCountry},p_issue_date:parsed.issueDate,p_service_date:parsed.serviceDate,p_due_date:parsed.dueDate,p_vat_treatment:parsed.vatTreatment,p_lines:parsed.lines,p_notes:parsed.notes||null});
  if(error)return{status:"error",message:error.message,invoiceId:null};const invoiceId=typeof data==="string"?data:null;if(!invoiceId)return{status:"error",message:"Correction failed to return a replacement invoice.",invoiceId:null};
  revalidatePath("/app");revalidatePath("/app/invoices");revalidatePath(`/app/invoices/${originalId}`);revalidatePath("/app/accounting");revalidatePath("/app/taxes");return{status:"success",message:"Original invoice reversed and corrected invoice issued.",invoiceId};
}

export async function voidInvoiceAction(_previous:InvoiceActionState,formData:FormData):Promise<InvoiceActionState>{
  const workspace=await getWorkspace();if(!workspace.authenticated||!workspace.company)return{status:"error",message:"Your session expired. Please sign in again.",invoiceId:null};
  const invoiceId=String(formData.get("invoice_id")??"");if(!/^[0-9a-f-]{36}$/i.test(invoiceId))return{status:"error",message:"Invalid invoice.",invoiceId:null};
  const supabase=await createClient();const{error}=await supabase.rpc("void_sales_invoice_safe",{p_invoice_id:invoiceId});if(error)return{status:"error",message:error.message,invoiceId:null};
  revalidatePath("/app");revalidatePath("/app/invoices");revalidatePath(`/app/invoices/${invoiceId}`);revalidatePath("/app/accounting");revalidatePath("/app/taxes");return{status:"success",message:"Invoice deleted from active receivables and reversed in the ledger.",invoiceId:null};
}
