import { ArrowLeft, CheckCircle2, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import styles from "@/components/invoice.module.css";
import { InvoicePaymentPanel } from "@/components/invoice-payment-panel";
import { InvoicePrintButton } from "@/components/invoice-print-button";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";
type Snapshot = Record<string, unknown>;
function value(snapshot: Snapshot, key: string) { const item = snapshot[key]; return typeof item === "string" ? item : ""; }
function address(snapshot: Snapshot) { const raw = snapshot.address ?? snapshot.registered_address; return raw && typeof raw === "object" ? raw as Record<string, unknown> : {}; }
function addressValue(raw: Record<string, unknown>, key: string) { const item = raw[key]; return typeof item === "string" ? item : ""; }
function money(amount: number, currency: string) { return new Intl.NumberFormat("en-LU", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount); }

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in");
  if (!workspace.company) redirect("/setup");
  const supabase = await createClient();
  const { data: invoice, error } = await supabase.from("sales_invoices").select("*").eq("id", id).eq("company_id", workspace.company.id).maybeSingle();
  if (error) throw new Error(`Could not load invoice: ${error.message}`);
  if (!invoice) notFound();

  const [linesResult, paymentsResult, bankResult] = await Promise.all([
    supabase.from("sales_invoice_lines").select("id,line_number,description,quantity,unit_price,vat_rate,net_amount,vat_amount,gross_amount").eq("invoice_id", invoice.id).order("line_number", { ascending: true }),
    supabase.from("invoice_payments").select("id,paid_on,amount,reference,bank_transaction_id,journal_entry_id").eq("invoice_id", invoice.id).order("paid_on", { ascending: false }),
    supabase.from("bank_transactions").select("id,booking_date,amount,counterparty_name,reference").eq("company_id", workspace.company.id).eq("match_status", "unmatched").gt("amount", 0).order("booking_date", { ascending: false }).limit(25),
  ]);
  if (linesResult.error) throw new Error(`Could not load invoice lines: ${linesResult.error.message}`);
  if (paymentsResult.error) throw new Error(`Could not load invoice payments: ${paymentsResult.error.message}`);
  if (bankResult.error) throw new Error(`Could not load bank candidates: ${bankResult.error.message}`);
  const lines = linesResult.data ?? [];
  const payments = paymentsResult.data ?? [];
  const paidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

  let journalNumber: number | null = null;
  if (invoice.journal_entry_id) {
    const { data: journal } = await supabase.from("journal_entries").select("entry_number").eq("id", invoice.journal_entry_id).maybeSingle();
    journalNumber = journal?.entry_number ?? null;
  }

  const issuer = (invoice.issuer_snapshot ?? {}) as Snapshot;
  const customer = (invoice.customer_snapshot ?? {}) as Snapshot;
  const issuerAddress = address(issuer);
  const customerAddress = address(customer);

  return (
    <div className={styles.invoiceDetailWrap}>
      <div className={styles.invoiceDetailActions}><Link href="/app/invoices" className={styles.backLink}><ArrowLeft size={14} />Invoices</Link><div><span className={styles.immutableBadge}><LockKeyhole size={13} />Issued document locked</span><InvoicePrintButton /></div></div>
      <article className={`${styles.invoicePaper} ${styles.detailPaper}`}>
        <header className={styles.invoiceHeader}><div><div className={styles.paperBrand}>C</div><strong>{value(issuer, "legal_name")}</strong><small>{value(issuer, "legal_form")}</small></div><div className={styles.invoiceWord}><span>INVOICE</span><small>{invoice.invoice_number}</small></div></header>
        <div className={styles.invoiceMetaGrid}><div><span>FROM</span><strong>{value(issuer, "legal_name")}</strong><p>{addressValue(issuerAddress, "street")}<br />{addressValue(issuerAddress, "postal_code")} {addressValue(issuerAddress, "city")}<br />Luxembourg</p></div><div><span>BILL TO</span><strong>{value(customer, "name")}</strong><p>{addressValue(customerAddress, "street")}<br />{addressValue(customerAddress, "postal_code")} {addressValue(customerAddress, "city")}<br />{value(customer, "country_code")}</p>{value(customer, "vat_number") ? <small>VAT {value(customer, "vat_number")}</small> : null}</div></div>
        <div className={styles.previewDates}><div><span>ISSUE</span><strong>{invoice.issue_date}</strong></div><div><span>SERVICE</span><strong>{invoice.service_date}</strong></div><div><span>DUE</span><strong>{invoice.due_date}</strong></div><div><span>STATUS</span><strong className={styles.statusText}><CheckCircle2 size={12} />{invoice.payment_status}</strong></div></div>
        <div className={styles.previewTable}><div className={styles.previewTableHead}><span>DESCRIPTION</span><span>QTY</span><span>RATE</span><span>AMOUNT</span></div>{lines.map((line) => <div className={styles.previewTableRow} key={line.id}><span>{line.description}<small>{Number(line.vat_rate)}% VAT</small></span><span>{Number(line.quantity)}</span><span>{money(Number(line.unit_price), invoice.currency)}</span><strong>{money(Number(line.net_amount), invoice.currency)}</strong></div>)}</div>
        <div className={styles.previewTotals}><div><span>Subtotal</span><strong>{money(Number(invoice.subtotal), invoice.currency)}</strong></div><div><span>VAT</span><strong>{money(Number(invoice.vat_total), invoice.currency)}</strong></div><div className={styles.totalRow}><span>Total</span><strong>{money(Number(invoice.total), invoice.currency)}</strong></div></div>
        {invoice.vat_treatment === "eu_b2b_reverse_charge" ? <div className={styles.reverseCharge}>AUTO-LIQUIDATION · REVERSE CHARGE</div> : null}
        {invoice.notes ? <div className={styles.invoiceNotes}><span>NOTE</span><p>{invoice.notes}</p></div> : null}
        <footer className={styles.invoiceFooter}><span>R.C.S. Luxembourg {value(issuer, "rcs_number")}</span><span>Autorisation {value(issuer, "business_permit_number")}</span><span>TVA {value(issuer, "vat_number")}</span></footer>
      </article>
      <div className={styles.postingReceipt}><CheckCircle2 size={15} /><div><strong>Accounting posted automatically</strong><span>{journalNumber ? `Journal entry J${String(journalNumber).padStart(4, "0")} · ` : ""}Customer receivable → service revenue{Number(invoice.vat_total) > 0 ? " → output VAT" : ""}</span></div></div>
      <InvoicePaymentPanel invoiceId={invoice.id} total={Number(invoice.total)} paid={paidAmount} currency={invoice.currency} paymentStatus={invoice.payment_status} candidates={bankResult.data ?? []} payments={payments} />
    </div>
  );
}
