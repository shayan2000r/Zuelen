import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { redirect } from "next/navigation";
import { SourceTransactionForm } from "@/components/source-transaction-form";
import styles from "@/components/live.module.css";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-LU", { style: "currency", currency, minimumFractionDigits: 2 }).format(value);
}

export default async function TransactionsPage() {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in");
  if (!workspace.company) redirect("/setup");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("source_transactions")
    .select("id,occurred_on,direction,amount_gross,amount_net,vat_amount,currency,counterparty_name,description,classification_status")
    .eq("company_id", workspace.company.id)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(`Could not load transactions: ${error.message}`);
  const rows = data ?? [];

  return (
    <div className={styles.liveWrap}>
      <div className={styles.liveIntro}>
        <div><p className={styles.eyebrow}>Bookkeeping source</p><h1>Transactions</h1><p>Record business activity without accounting jargon. Compta keeps source data flexible until you deliberately classify and post it.</p></div>
        <span className={styles.liveBadge}><span>{rows.length}</span> records</span>
      </div>

      <section className={styles.transactionLayout}>
        <SourceTransactionForm />
        <article className={styles.ledgerPanel}>
          <div className={styles.ledgerHead}><div><p className={styles.eyebrow}>Activity log</p><h2>Recorded transactions</h2></div><span>Newest first</span></div>
          {rows.length === 0 ? (
            <div className={styles.emptyState}><h3>No transactions yet.</h3><p>Use the form to record the first real activity in this workspace.</p></div>
          ) : (
            <table className={styles.ledgerTable}>
              <thead><tr><th>Date</th><th>Transaction</th><th>Status</th><th>Amount</th></tr></thead>
              <tbody>
                {rows.map((row) => {
                  const income = row.direction === "income";
                  return (
                    <tr key={row.id}>
                      <td>{new Date(`${row.occurred_on}T12:00:00`).toLocaleDateString("en-LU", { day: "2-digit", month: "short" })}</td>
                      <td className={styles.ledgerName}><strong>{row.counterparty_name || row.description || (income ? "Income" : "Expense")}</strong><small>{row.amount_net !== null ? `Net ${money(Number(row.amount_net), row.currency)}` : ""}{row.vat_amount ? ` · VAT ${money(Number(row.vat_amount), row.currency)}` : ""}</small></td>
                      <td><span className={styles.rowStatus}>{row.classification_status}</span></td>
                      <td className={income ? styles.incomeAmount : styles.expenseAmount}>{income ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}{income ? "+" : "−"}{money(Number(row.amount_gross), row.currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </article>
      </section>
    </div>
  );
}
