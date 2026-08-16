import { redirect } from "next/navigation";
import { InvoiceComposer } from "@/components/invoice-composer";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in");
  if (!workspace.company) redirect("/setup");

  return <InvoiceComposer company={{
    legal_name: workspace.company.legal_name,
    legal_form: workspace.company.legal_form,
    rcs_number: workspace.company.rcs_number,
    vat_number: workspace.company.vat_number,
    business_permit_number: workspace.company.business_permit_number,
    registered_address: workspace.company.registered_address,
    base_currency: workspace.company.base_currency,
  }} />;
}
