import { notFound, redirect } from "next/navigation";
import { InvoiceComposer, type InvoiceComposerInitial } from "@/components/invoice-composer";
import { canBookkeep } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export const dynamic="force-dynamic";
function obj(value:unknown){return value&&typeof value==="object"?value as Record<string,unknown>:{};}function str(value:unknown){return typeof value==="string"?value:"";}
export default async function EditDraftInvoicePage({params}:{params:Promise<{id:string}>}){
  const{id}=await params;const workspace=await getWorkspace();if(!workspace.authenticated)redirect("/sign-in");if(!workspace.company)redirect("/setup");if(!canBookkeep(workspace.role))redirect(`/app/invoices/${id}`);const supabase=await createClient();
  const{data:invoice,error}=await supabase.from("sales_invoices").select("*").eq("id",id).eq("company_id",workspace.company.id).maybeSingle();if(error)throw new Error(`Could not load invoice: ${error.message}`);if(!invoice||invoice.status!=="draft")notFound();
  const{data:lines,error:lineError}=await supabase.from("sales_invoice_lines").select("line_number,description,quantity,unit_price,vat_rate").eq("invoice_id",id).order("line_number",{ascending:true});if(lineError)throw new Error(`Could not load invoice lines: ${lineError.message}`);
  const customer=obj(invoice.customer_snapshot),address=obj(customer.address);
  const initial:InvoiceComposerInitial={customer_name:str(customer.name),customer_email:str(customer.email),customer_country:str(customer.country_code)||"LU",customer_vat_number:str(customer.vat_number),customer_street:str(address.street),customer_postal_code:str(address.postal_code),customer_city:str(address.city),issue_date:invoice.issue_date,service_date:invoice.service_date,due_date:invoice.due_date,vat_treatment:invoice.vat_treatment,notes:invoice.notes??"",lines:(lines??[]).map((line,index)=>({id:index+1,description:line.description,quantity:Number(line.quantity),unit_price:Number(line.unit_price),vat_rate:Number(line.vat_rate)}))};
  return <InvoiceComposer company={workspace.company} initialInvoice={initial} draftInvoiceId={id}/>;
}
