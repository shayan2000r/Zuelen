import { ArrowRight, BookOpen, CheckCircle2, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TransactionRowActions } from "@/components/transaction-row-actions";
import { AccountingInvoiceActions, AccountingPaymentActions, AccountingReadOnlyAction } from "@/components/accounting-entry-actions";
import actionStyles from "@/components/accounting-actions.module.css";
import styles from "@/components/live.module.css";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type JournalLine = {
  id: string;
  journal_entry_id: string;
  company_account_id: string;
  description: string | null;
  debit: number | string;
  credit: number | string;
  currency: string;
};
type Account = { id: string; code: string; label: string; account_type: string };
type SourceTransaction = {
  id: string;
  occurred_on: string;
  direction: string;
  amount_gross: number | string;
  vat_amount: number | string | null;
  counterparty_name: string | null;
  description: string | null;
  classification_status: string;
  posted_journal_entry_id: string | null;
};
type Invoice = { id: string; status: string; payment_status: string };
type Payment = {
  id: string;
  invoice_id: string;
  amount: number | string;
  paid_on: string;
  reference: string | null;
  bank_transaction_id: string | null;
  journal_entry_id: string;
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-LU", { style: "currency", currency, minimumFractionDigits: 2 }).format(value);
}

export default async function AccountingPage() {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in");
  if (!workspace.company) redirect("/setup");

  const supabase = await createClient();
  const [{ data: entryData, error: entryError }, { data: accountData, error: accountError }] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("id,entry_number,entry_date,description,source_type,source_id,status,posted_at,reversal_of")
      .eq("company_id", workspace.company.id)
      .order("entry_number", { ascending: false })
      .limit(100),
    supabase
      .from("company_accounts")
      .select("id,code,label,account_type")
      .eq("company_id", workspace.company.id),
  ]);

  if (entryError) throw new Error(`Could not load journal entries: ${entryError.message}`);
  if (accountError) throw new Error(`Could not load chart of accounts: ${accountError.message}`);

  const entries = entryData ?? [];
  const entryIds = entries.map((entry) => entry.id);
  let lineRows: JournalLine[] = [];
  if (entryIds.length > 0) {
    const { data: lineData, error: lineError } = await supabase
      .from("journal_lines")
      .select("id,journal_entry_id,company_account_id,description,debit,credit,currency")
      .in("journal_entry_id", entryIds)
      .order("created_at", { ascending: true });
    if (lineError) throw new Error(`Could not load journal lines: ${lineError.message}`);
    lineRows = (lineData ?? []) as JournalLine[];
  }

  const manualSourceIds = entries.filter((entry) => entry.source_type === "manual" && entry.source_id).map((entry) => entry.source_id as string);
  const invoiceSourceIds = entries.filter((entry) => entry.source_type === "invoice" && entry.source_id).map((entry) => entry.source_id as string);
  const bankEntryIds = entries.filter((entry) => entry.source_type === "bank").map((entry) => entry.id);

  let sourceRows: SourceTransaction[] = [];
  let invoiceRows: Invoice[] = [];
  let paymentRows: Payment[] = [];

  if (manualSourceIds.length > 0) {
    const { data, error } = await supabase.from("source_transactions")
      .select("id,occurred_on,direction,amount_gross,vat_amount,counterparty_name,description,classification_status,posted_journal_entry_id")
      .in("id", manualSourceIds);
    if (error) throw new Error(`Could not load transaction sources: ${error.message}`);
    sourceRows = (data ?? []) as SourceTransaction[];
  }
  if (invoiceSourceIds.length > 0) {
    const { data, error } = await supabase.from("sales_invoices").select("id,status,payment_status").in("id", invoiceSourceIds);
    if (error) throw new Error(`Could not load invoice sources: ${error.message}`);
    invoiceRows = (data ?? []) as Invoice[];
  }
  if (bankEntryIds.length > 0) {
    const { data, error } = await supabase.from("invoice_payments")
      .select("id,invoice_id,amount,paid_on,reference,bank_transaction_id,journal_entry_id")
      .in("journal_entry_id", bankEntryIds);
    if (error) throw new Error(`Could not load payment sources: ${error.message}`);
    paymentRows = (data ?? []) as Payment[];
  }

  const accounts = (accountData ?? []) as Account[];
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const sourceMap = new Map(sourceRows.map((row) => [row.id, row]));
  const invoiceMap = new Map(invoiceRows.map((row) => [row.id, row]));
  const paymentByEntry = new Map(paymentRows.map((row) => [row.journal_entry_id, row]));
  const linesByEntry = new Map<string, JournalLine[]>();
  for (const line of lineRows) {
    const group = linesByEntry.get(line.journal_entry_id) ?? [];
    group.push(line);
    linesByEntry.set(line.journal_entry_id, group);
  }

  return (
    <div className={styles.liveWrap}>
      <div className={styles.liveIntro}>
        <div><p className={styles.eyebrow}>Double-entry ledger</p><h1>Accounting</h1><p>The journal stays auditable, but you do not have to manage it like an accountant. Use the source controls below each entry and Compta creates the required reversals automatically.</p></div>
        <span className={styles.liveBadge}><LockKeyhole size={13} />{entries.length} journal entries</span>
      </div>

      {entries.length === 0 ? (
        <article className={styles.panel}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}><BookOpen size={20} /></div>
            <h3>No journal entries yet.</h3>
            <p>Record a transaction, classify it and post it. The balanced entry will appear here automatically.</p>
            <Link href="/app/transactions" className={styles.actionLink}>Open transactions <ArrowRight size={14} /></Link>
          </div>
        </article>
      ) : (
        <section className={styles.journalList}>
          {entries.map((entry) => {
            const lines = linesByEntry.get(entry.id) ?? [];
            const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit), 0);
            const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit), 0);
            const currency = lines[0]?.currency || workspace.company?.base_currency || "EUR";
            const source = entry.source_type === "manual" && entry.source_id ? sourceMap.get(entry.source_id) : undefined;
            const invoice = entry.source_type === "invoice" && entry.source_id ? invoiceMap.get(entry.source_id) : undefined;
            const payment = paymentByEntry.get(entry.id);
            const isCurrentTransactionPosting = Boolean(source && source.posted_journal_entry_id === entry.id && source.classification_status === "posted");

            let sourceLabel = "System-generated accounting entry";
            let sourceActions = <AccountingReadOnlyAction>Audit entry · read only</AccountingReadOnlyAction>;

            if (entry.source_type === "manual") {
              sourceLabel = source ? "Source transaction" : "Historical transaction source";
              sourceActions = source && isCurrentTransactionPosting
                ? <TransactionRowActions row={source} />
                : <AccountingReadOnlyAction>{source ? "Superseded posting · audit history" : "Source deleted · reversal retained"}</AccountingReadOnlyAction>;
            } else if (entry.source_type === "invoice") {
              sourceLabel = "Sales invoice";
              sourceActions = invoice
                ? <AccountingInvoiceActions invoiceId={invoice.id} status={invoice.status} paymentStatus={invoice.payment_status} />
                : <AccountingReadOnlyAction>Historical invoice entry</AccountingReadOnlyAction>;
            } else if (entry.source_type === "bank" && payment) {
              sourceLabel = "Invoice payment";
              sourceActions = <AccountingPaymentActions payment={payment} />;
            } else if (entry.source_type === "reversal") {
              sourceLabel = "Reversal entry";
              sourceActions = <AccountingReadOnlyAction>Reversal · audit history</AccountingReadOnlyAction>;
            } else if (entry.source_type === "bank") {
              sourceLabel = "Bank / settlement entry";
              sourceActions = <AccountingReadOnlyAction>Reversed or reconciliation-managed</AccountingReadOnlyAction>;
            }

            return (
              <details className={styles.journalCard} key={entry.id}>
                <summary className={styles.journalSummary}>
                  <span className={styles.journalNumber}>J{String(entry.entry_number).padStart(4, "0")}</span>
                  <span className={styles.journalCopy}><strong>{entry.description}</strong><small>{new Date(`${entry.entry_date}T12:00:00`).toLocaleDateString("en-LU", { day: "2-digit", month: "short", year: "numeric" })} · {entry.source_type}{entry.reversal_of ? " · reversal" : ""}</small></span>
                  <span className={styles.journalStatus}><CheckCircle2 size={12} />{entry.status}</span>
                  <span className={styles.journalTotal}>{money(Math.max(totalDebit, totalCredit), currency)}</span>
                </summary>
                <div className={styles.journalDetails}>
                  <div className={styles.journalLineHeader}><span>Account</span><span>Debit</span><span>Credit</span></div>
                  {lines.map((line) => {
                    const account = accountMap.get(line.company_account_id);
                    return (
                      <div className={styles.journalLine} key={line.id}>
                        <span className={styles.journalAccount}><b>{account?.code ?? "—"}</b><span>{account?.label ?? line.description ?? "Account"}</span></span>
                        <span>{Number(line.debit) > 0 ? money(Number(line.debit), line.currency) : "—"}</span>
                        <span>{Number(line.credit) > 0 ? money(Number(line.credit), line.currency) : "—"}</span>
                      </div>
                    );
                  })}
                  <div className={styles.journalBalance}><span>Balanced entry</span><strong>Dr {money(totalDebit, currency)} = Cr {money(totalCredit, currency)}</strong></div>
                  <div className={actionStyles.sourceBar}>
                    <div className={actionStyles.sourceCopy}><span>Manage source</span><strong>{sourceLabel}</strong></div>
                    {sourceActions}
                  </div>
                </div>
              </details>
            );
          })}
        </section>
      )}
    </div>
  );
}
