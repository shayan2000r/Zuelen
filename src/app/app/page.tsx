import { ArrowDownLeft, ArrowRight, ArrowUpRight, CircleDollarSign, ReceiptText, Scale, WalletCards } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "@/components/live.module.css";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

function money(value: number, currency = "EUR") {
  return new Intl.NumberFormat("en-LU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export default async function LiveOverviewPage() {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in");
  if (!workspace.company) redirect("/setup");

  const year = new Date().getFullYear();
  const supabase = await createClient();
  const { data: transactions, error } = await supabase
    .from("source_transactions")
    .select("id,occurred_on,direction,amount_gross,amount_net,vat_amount,currency,counterparty_name,description,classification_status")
    .eq("company_id", workspace.company.id)
    .gte("occurred_on", `${year}-01-01`)
    .lte("occurred_on", `${year}-12-31`)
    .order("occurred_on", { ascending: false });

  if (error) throw new Error(`Could not load bookkeeping data: ${error.message}`);

  const rows = transactions ?? [];
  let revenue = 0;
  let expenses = 0;
  let outputVat = 0;
  let inputVat = 0;
  let attention = 0;

  for (const row of rows) {
    const net = Number(row.amount_net ?? row.amount_gross ?? 0);
    const vat = Number(row.vat_amount ?? 0);
    if (row.direction === "income") {
      revenue += net;
      outputVat += vat;
    } else if (row.direction === "expense") {
      expenses += net;
      inputVat += vat;
    }
    if (["unclassified", "review"].includes(row.classification_status)) attention += 1;
  }

  const profit = revenue - expenses;
  const vatPosition = outputVat - inputVat;
  const currency = workspace.company.base_currency || "EUR";
  const recent = rows.slice(0, 6);

  const metrics = [
    { label: "Recorded revenue", value: money(revenue, currency), meta: `${rows.filter((r) => r.direction === "income").length} income entries`, icon: ArrowUpRight, tone: styles.positive },
    { label: "Recorded expenses", value: money(expenses, currency), meta: `${rows.filter((r) => r.direction === "expense").length} expense entries`, icon: ArrowDownLeft, tone: "" },
    { label: "Provisional profit", value: money(profit, currency), meta: "Before closing and tax adjustments", icon: Scale, tone: profit >= 0 ? styles.positive : styles.warning },
    { label: "VAT position", value: money(vatPosition, currency), meta: vatPosition >= 0 ? "Provisional amount payable" : "Provisional credit", icon: CircleDollarSign, tone: vatPosition > 0 ? styles.warning : styles.positive },
  ];

  return (
    <div className={styles.liveWrap}>
      <div className={styles.liveIntro}>
        <div>
          <p className={styles.eyebrow}>Live books · {year}</p>
          <h1>Your company, in real time.</h1>
          <p>These figures are calculated from your recorded business activity. They remain provisional until transactions are classified and posted to the accounting ledger.</p>
        </div>
        <span className={styles.liveBadge}><i className={styles.pulse} />Supabase live workspace</span>
      </div>

      <section className={styles.metricGrid}>
        {metrics.map((metric) => (
          <article className={styles.metricCard} key={metric.label}>
            <div className={styles.metricTop}><span>{metric.label}</span><span className={styles.metricIcon}><metric.icon size={15} /></span></div>
            <div className={styles.metricValue}>{metric.value}</div>
            <div className={`${styles.metricMeta} ${metric.tone}`}>{metric.meta}</div>
          </article>
        ))}
      </section>

      <section className={styles.commandGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHead}>
            <div><p className={styles.eyebrow}>Recent activity</p><h2>Bookkeeping feed</h2></div>
            <Link href="/app/transactions" className={styles.actionLink}>Open transactions <ArrowRight size={14} /></Link>
          </div>
          {recent.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}><WalletCards size={20} /></div>
              <h3>Your ledger starts with one transaction.</h3>
              <p>Add an income or expense entry. Compta will immediately update your revenue, expenses, provisional profit and VAT position.</p>
              <Link href="/app/transactions" className={styles.actionLink}>Record first transaction <ArrowRight size={14} /></Link>
            </div>
          ) : (
            <div className={styles.transactionList}>
              {recent.map((row) => {
                const income = row.direction === "income";
                return (
                  <div className={styles.transactionRow} key={row.id}>
                    <span className={`${styles.transactionIcon} ${income ? styles.transactionIconIncome : styles.transactionIconExpense}`}>
                      {income ? <ArrowUpRight size={15} /> : <ArrowDownLeft size={15} />}
                    </span>
                    <span className={styles.transactionCopy}><strong>{row.counterparty_name || row.description || (income ? "Income" : "Expense")}</strong><small>{new Date(`${row.occurred_on}T12:00:00`).toLocaleDateString("en-LU", { day: "2-digit", month: "short", year: "numeric" })}{row.vat_amount ? ` · VAT ${money(Number(row.vat_amount), row.currency)}` : ""}</small></span>
                    <span className={styles.amount}>{income ? "+" : "−"}{money(Number(row.amount_gross), row.currency)}</span>
                    <span className={`${styles.status} ${["unclassified", "review"].includes(row.classification_status) ? styles.statusReview : ""}`}>{row.classification_status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <aside className={`${styles.panel} ${styles.healthCard}`}>
          <p className={styles.eyebrow}>Accounting readiness</p>
          <h2>{attention === 0 ? "Nothing needs review." : `${attention} ${attention === 1 ? "item" : "items"} need review.`}</h2>
          <p>Source transactions stay editable while you work. Once classified and posted, the journal becomes immutable and corrections use reversal entries.</p>
          <div className={styles.healthScore}><strong>{rows.length === 0 ? 0 : Math.round(((rows.length - attention) / rows.length) * 100)}</strong><span>% classified</span></div>
          <div className={styles.healthTrack}><span style={{ width: `${rows.length === 0 ? 0 : Math.round(((rows.length - attention) / rows.length) * 100)}%` }} /></div>
          <div className={styles.healthMeta}>
            <span><span>Transactions recorded</span><strong>{rows.length}</strong></span>
            <span><span>Needs review</span><strong>{attention}</strong></span>
            <span><span>Posted entries</span><strong>{rows.filter((r) => r.classification_status === "posted").length}</strong></span>
          </div>
        </aside>
      </section>
    </div>
  );
}
