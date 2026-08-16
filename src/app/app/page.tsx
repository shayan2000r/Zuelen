import { ArrowDownLeft, ArrowRight, ArrowUpRight, CircleDollarSign, Scale, WalletCards } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "@/components/live.module.css";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type LedgerLine = { journal_entry_id: string; company_account_id: string; debit: number | string; credit: number | string };
type LedgerAccount = { id: string; code: string; account_type: string };

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
  const [{ data: transactions, error }, { data: entryData, error: entryError }, { data: accountData, error: accountError }] = await Promise.all([
    supabase
      .from("source_transactions")
      .select("id,occurred_on,direction,amount_gross,amount_net,vat_amount,currency,counterparty_name,description,classification_status")
      .eq("company_id", workspace.company.id)
      .gte("occurred_on", `${year}-01-01`)
      .lte("occurred_on", `${year}-12-31`)
      .order("occurred_on", { ascending: false }),
    supabase
      .from("journal_entries")
      .select("id,entry_number")
      .eq("company_id", workspace.company.id)
      .eq("status", "posted")
      .gte("entry_date", `${year}-01-01`)
      .lte("entry_date", `${year}-12-31`),
    supabase
      .from("company_accounts")
      .select("id,code,account_type")
      .eq("company_id", workspace.company.id),
  ]);

  if (error) throw new Error(`Could not load bookkeeping data: ${error.message}`);
  if (entryError) throw new Error(`Could not load posted ledger: ${entryError.message}`);
  if (accountError) throw new Error(`Could not load chart of accounts: ${accountError.message}`);

  const rows = transactions ?? [];
  const postedEntries = entryData ?? [];
  const accounts = (accountData ?? []) as LedgerAccount[];
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  let ledgerLines: LedgerLine[] = [];

  if (postedEntries.length > 0) {
    const { data: lineData, error: lineError } = await supabase
      .from("journal_lines")
      .select("journal_entry_id,company_account_id,debit,credit")
      .in("journal_entry_id", postedEntries.map((entry) => entry.id));
    if (lineError) throw new Error(`Could not load ledger balances: ${lineError.message}`);
    ledgerLines = (lineData ?? []) as LedgerLine[];
  }

  let revenue = 0;
  let expenses = 0;
  let outputVat = 0;
  let inputVat = 0;

  for (const line of ledgerLines) {
    const account = accountMap.get(line.company_account_id);
    if (!account) continue;
    const debit = Number(line.debit);
    const credit = Number(line.credit);
    if (account.account_type === "revenue") revenue += credit - debit;
    if (account.account_type === "expense") expenses += debit - credit;
    if (account.code === "461411") outputVat += credit - debit;
    if (account.code === "421611") inputVat += debit - credit;
  }

  const pendingRows = rows.filter((row) => row.classification_status !== "posted");
  for (const row of pendingRows) {
    const net = Number(row.amount_net ?? row.amount_gross ?? 0);
    const vat = Number(row.vat_amount ?? 0);
    if (row.direction === "income") {
      revenue += net;
      outputVat += vat;
    } else if (row.direction === "expense") {
      expenses += net;
      inputVat += vat;
    }
  }

  const attention = pendingRows.length;
  const profit = revenue - expenses;
  const vatPosition = outputVat - inputVat;
  const currency = workspace.company.base_currency || "EUR";
  const recent = rows.slice(0, 6);

  const metrics = [
    { label: "Revenue", value: money(revenue, currency), meta: `${postedEntries.length} posted entries · ${attention} provisional`, icon: ArrowUpRight, tone: styles.positive },
    { label: "Expenses", value: money(expenses, currency), meta: "Assets stop affecting P&L once classified", icon: ArrowDownLeft, tone: "" },
    { label: "Provisional profit", value: money(profit, currency), meta: "Posted ledger + activity awaiting review", icon: Scale, tone: profit >= 0 ? styles.positive : styles.warning },
    { label: "VAT position", value: money(vatPosition, currency), meta: vatPosition >= 0 ? "Provisional amount payable" : "Provisional credit", icon: CircleDollarSign, tone: vatPosition > 0 ? styles.warning : styles.positive },
  ];

  return (
    <div className={styles.liveWrap}>
      <div className={styles.liveIntro}>
        <div>
          <p className={styles.eyebrow}>Live books · {year}</p>
          <h1>Your company, in real time.</h1>
          <p>Posted entries come from the double-entry ledger. Activity still awaiting classification remains visible as provisional so nothing disappears from your operating view.</p>
        </div>
        <span className={styles.liveBadge}><i className={styles.pulse} />Live accounting workspace</span>
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
              <p>Add an income or expense entry. Compta will immediately surface it, then convert it into accounting once reviewed.</p>
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
                    <span className={`${styles.status} ${row.classification_status !== "posted" ? styles.statusReview : styles.postedStatus}`}>{row.classification_status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <aside className={`${styles.panel} ${styles.healthCard}`}>
          <p className={styles.eyebrow}>Accounting readiness</p>
          <h2>{attention === 0 ? "Nothing needs review." : `${attention} ${attention === 1 ? "item" : "items"} need review.`}</h2>
          <p>Source transactions stay editable while you work. Once classified and posted, both the journal and linked source evidence are protected from silent edits.</p>
          <div className={styles.healthScore}><strong>{rows.length === 0 ? 0 : Math.round(((rows.length - attention) / rows.length) * 100)}</strong><span>% classified</span></div>
          <div className={styles.healthTrack}><span style={{ width: `${rows.length === 0 ? 0 : Math.round(((rows.length - attention) / rows.length) * 100)}%` }} /></div>
          <div className={styles.healthMeta}>
            <span><span>Transactions recorded</span><strong>{rows.length}</strong></span>
            <span><span>Needs review</span><strong>{attention}</strong></span>
            <span><span>Posted journal entries</span><strong>{postedEntries.length}</strong></span>
          </div>
        </aside>
      </section>
    </div>
  );
}
