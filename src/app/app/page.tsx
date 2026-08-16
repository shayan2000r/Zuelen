import { ArrowDownRight, ArrowUpRight, CalendarClock, Landmark, ReceiptText, Upload, WalletCards } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type LedgerLine = { journal_entry_id: string; company_account_id: string; debit: number | string; credit: number | string };
type LedgerAccount = { id: string; code: string; account_type: string };

function money(value: number, currency = "EUR") {
  return new Intl.NumberFormat("en-LU", { style: "currency", currency, minimumFractionDigits: 2 }).format(value);
}
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }

export default async function LiveOverviewPage() {
  const workspace = await getWorkspace();
  if (!workspace.authenticated) redirect("/sign-in");
  if (!workspace.company) redirect("/setup");

  const now = new Date();
  const year = now.getFullYear();
  const currency = workspace.company.base_currency || "EUR";
  const supabase = await createClient();
  const [transactionsResult, entriesResult, accountsResult, invoicesResult, obligationsResult] = await Promise.all([
    supabase.from("source_transactions").select("id,occurred_on,direction,amount_gross,amount_net,vat_amount,currency,counterparty_name,description,classification_status").eq("company_id", workspace.company.id).gte("occurred_on", `${year}-01-01`).lte("occurred_on", `${year}-12-31`).order("occurred_on", { ascending: false }),
    supabase.from("journal_entries").select("id,entry_number").eq("company_id", workspace.company.id).eq("status", "posted").gte("entry_date", `${year}-01-01`).lte("entry_date", `${year}-12-31`),
    supabase.from("company_accounts").select("id,code,account_type").eq("company_id", workspace.company.id),
    supabase.from("sales_invoices").select("id,invoice_number,total,due_date,payment_status,customer_snapshot").eq("company_id", workspace.company.id).eq("status", "issued").order("due_date", { ascending: true }),
    supabase.from("compliance_obligations").select("id,authority,obligation_type,due_date,amount,currency,status,period_label").eq("company_id", workspace.company.id).not("status", "in", '(paid,filed,not_applicable)').order("due_date", { ascending: true, nullsFirst: false }).limit(4),
  ]);

  if (transactionsResult.error) throw new Error(`Could not load bookkeeping data: ${transactionsResult.error.message}`);
  if (entriesResult.error) throw new Error(`Could not load posted ledger: ${entriesResult.error.message}`);
  if (accountsResult.error) throw new Error(`Could not load chart of accounts: ${accountsResult.error.message}`);
  if (invoicesResult.error) throw new Error(`Could not load receivables: ${invoicesResult.error.message}`);
  if (obligationsResult.error) throw new Error(`Could not load compliance obligations: ${obligationsResult.error.message}`);

  const rows = transactionsResult.data ?? [];
  const postedEntries = entriesResult.data ?? [];
  const accounts = (accountsResult.data ?? []) as LedgerAccount[];
  const invoices = invoicesResult.data ?? [];
  const obligations = obligationsResult.data ?? [];
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  let ledgerLines: LedgerLine[] = [];

  if (postedEntries.length > 0) {
    const { data, error } = await supabase.from("journal_lines").select("journal_entry_id,company_account_id,debit,credit").in("journal_entry_id", postedEntries.map((entry) => entry.id));
    if (error) throw new Error(`Could not load ledger balances: ${error.message}`);
    ledgerLines = (data ?? []) as LedgerLine[];
  }

  let revenue = 0, expenses = 0, outputVat = 0, inputVat = 0, bankBalance = 0, receivables = 0;
  for (const line of ledgerLines) {
    const account = accountMap.get(line.company_account_id); if (!account) continue;
    const debit = Number(line.debit), credit = Number(line.credit);
    if (account.account_type === "revenue") revenue += credit - debit;
    if (account.account_type === "expense") expenses += debit - credit;
    if (account.code === "461411") outputVat += credit - debit;
    if (account.code === "421611") inputVat += debit - credit;
    if (account.code === "5131") bankBalance += debit - credit;
    if (account.code === "4011") receivables += debit - credit;
  }

  const pendingRows = rows.filter((row) => row.classification_status !== "posted");
  for (const row of pendingRows) {
    const net = Number(row.amount_net ?? row.amount_gross ?? 0), vat = Number(row.vat_amount ?? 0);
    if (row.direction === "income") { revenue += net; outputVat += vat; }
    if (row.direction === "expense") { expenses += net; inputVat += vat; }
  }

  const profit = revenue - expenses;
  const vatPosition = outputVat - inputVat;
  const knownReserve = Math.max(vatPosition, 0);
  const safeCash = bankBalance - knownReserve;
  const freeCashPct = bankBalance > 0 ? clamp(Math.round((safeCash / bankBalance) * 100), 0, 100) : 0;
  const attention = pendingRows.length + invoices.filter((invoice) => invoice.payment_status !== "paid" && new Date(`${invoice.due_date}T23:59:59`) < now).length;
  const readiness = rows.length === 0 ? 0 : Math.round(((rows.length - pendingRows.length) / rows.length) * 100);
  const recent = rows.slice(0, 3);
  const overdueInvoices = invoices.filter((invoice) => invoice.payment_status !== "paid" && new Date(`${invoice.due_date}T23:59:59`) < now);
  const nextObligation = obligations[0] ?? null;
  const last30Start = new Date(now); last30Start.setDate(last30Start.getDate() - 30);
  const last30Movement = rows.filter((row) => new Date(`${row.occurred_on}T12:00:00`) >= last30Start).reduce((sum, row) => sum + (row.direction === "income" ? Number(row.amount_gross) : -Number(row.amount_gross)), 0);

  const customerName = (snapshot: unknown) => {
    if (!snapshot || typeof snapshot !== "object") return "Customer";
    const name = (snapshot as Record<string, unknown>).name;
    return typeof name === "string" && name ? name : "Customer";
  };

  return (
    <div className="content-wrap">
      <div className="intro-row">
        <div><p className="eyebrow">{now.toLocaleDateString("en-LU", { weekday: "long", day: "2-digit", month: "long" })}</p><h1>Your company, at a glance.</h1><p className="intro-copy">Live from the ledger. <strong>{attention === 0 ? "Nothing urgent" : `${attention} ${attention === 1 ? "item" : "items"}`}</strong> currently need attention.</p></div>
        <div className="intro-actions"><Link href="/app/transactions" className="secondary-btn"><Upload size={16} />Record activity</Link><button className="period-btn"><CalendarClock size={16} />{year}</button></div>
      </div>

      <section className="hero-grid">
        <article className="safe-cash-panel">
          <div className="panel-kicker"><span className="live-dot" />Safe to use</div>
          <div className="cash-main"><div><div className="big-money">{money(safeCash, currency)}</div><p>Bank balance after currently known VAT reserves. Direct-tax reserve will join this calculation in the tax engine.</p></div><div className="cash-ring" aria-label={`${freeCashPct} percent of cash available`}><div><strong>{freeCashPct}%</strong><span>free cash</span></div></div></div>
          <div className="cash-breakdown"><div><span>Bank ledger</span><strong>{money(bankBalance, currency)}</strong></div><div className="minus"><span>Known reserve</span><strong>− {money(knownReserve, currency)}</strong></div><div className="divider" /><div><span>Last 30 days</span><strong className={last30Movement >= 0 ? "positive" : "warning"}>{last30Movement >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}{money(Math.abs(last30Movement), currency)}</strong></div></div>
          <div className="hero-watermark">C</div>
        </article>
        <article className="deadline-panel">
          <div className="deadline-top"><div className="authority-badge">{nextObligation?.authority ?? "COMPTA"}</div><span className="status-chip warning-chip">{nextObligation ? "Next deadline" : "Calendar ready"}</span></div>
          <div className="deadline-date"><span>{nextObligation?.due_date ? new Date(`${nextObligation.due_date}T12:00:00`).getDate() : "—"}</span><small>{nextObligation?.due_date ? new Date(`${nextObligation.due_date}T12:00:00`).toLocaleDateString("en-LU", { month: "short" }).toUpperCase() : ""}</small></div>
          <h2>{nextObligation?.obligation_type?.replaceAll("_", " ") ?? "No deadline loaded yet"}</h2><p>{nextObligation ? `${nextObligation.authority} · ${nextObligation.period_label ?? year}` : "Compliance rules will populate this card as obligations are activated."}</p>
          <div className="deadline-bottom"><strong>{nextObligation?.amount != null ? money(Number(nextObligation.amount), nextObligation.currency || currency) : "Up to date"}</strong><span>{nextObligation?.status ?? "ready"}</span></div>
        </article>
      </section>

      <section className="metrics-row">
        <article className="metric"><span>Revenue</span><div className="metric-value">{money(revenue, currency)}</div><small className="positive"><ArrowUpRight size={13} />Live ledger</small></article>
        <article className="metric"><span>Expenses</span><div className="metric-value">{money(expenses, currency)}</div><small>{revenue > 0 ? `${Math.round((expenses / revenue) * 100)}% of revenue` : "No revenue ratio yet"}</small></article>
        <article className="metric"><span>Est. profit</span><div className="metric-value">{money(profit, currency)}</div><small className={profit >= 0 ? "positive" : "warning"}>{pendingRows.length ? `${pendingRows.length} provisional` : "Fully posted"}</small></article>
        <article className="metric"><span>VAT position</span><div className="metric-value">{money(vatPosition, currency)}</div><small className={vatPosition > 0 ? "warning" : "positive"}>{vatPosition > 0 ? "payable" : vatPosition < 0 ? "credit" : "balanced"}</small></article>
      </section>

      <section className="main-grid">
        <article className="attention-panel">
          <div className="section-head"><div><p className="section-kicker">Attention</p><h2>Your accounting inbox</h2></div><Link href="/app/transactions" className="text-btn">Review all <span>{attention}</span></Link></div>
          <div className="inbox-list">
            {pendingRows.slice(0, 2).map((row, index) => <Link href="/app/transactions" className="inbox-item" key={row.id}><span className="item-icon review"><ReceiptText size={17} /></span><span className="item-copy"><strong>{row.counterparty_name || row.description || "Transaction"}</strong><small>{money(Number(row.amount_gross), row.currency)} · Needs classification</small></span><span className="item-action">Confirm accounting treatment</span><span className="item-index">0{index + 1}</span></Link>)}
            {overdueInvoices.slice(0, Math.max(0, 3 - pendingRows.slice(0, 2).length)).map((invoice, index) => <Link href={`/app/invoices/${invoice.id}`} className="inbox-item" key={invoice.id}><span className="item-icon missing"><WalletCards size={17} /></span><span className="item-copy"><strong>{customerName(invoice.customer_snapshot)}</strong><small>{invoice.invoice_number} · {money(Number(invoice.total), currency)} overdue</small></span><span className="item-action">Match payment</span><span className="item-index">0{pendingRows.slice(0, 2).length + index + 1}</span></Link>)}
            {attention === 0 ? <div className="inbox-item"><span className="item-icon eu"><Landmark size={17} /></span><span className="item-copy"><strong>Inbox clear</strong><small>Nothing currently needs accounting review.</small></span><span className="item-action">Books are ready</span><span className="item-index">✓</span></div> : null}
          </div>
          <div className="inbox-footer"><span>Posted entries are protected from silent edits. Unreviewed activity stays visible until classified.</span></div>
        </article>

        <aside className="reserve-panel">
          <div className="section-head compact"><div><p className="section-kicker">Known reserve</p><h2>{money(knownReserve, currency)}</h2></div><span className="status-chip good-chip">Live</span></div>
          <div className="reserve-visual"><div className="reserve-bars">{[34,46,39,58,51,66,62,Math.max(8, Math.min(88, vatPosition > 0 ? 78 : 18))].map((height, i) => <span key={i} style={{ height: `${height}%` }} />)}</div><div className="target-line"><span>current</span></div></div>
          <div className="reserve-row"><span>VAT reserve</span><strong>{money(Math.max(vatPosition, 0), currency)}</strong></div><div className="reserve-row"><span>Receivables</span><strong>{money(Math.max(receivables, 0), currency)}</strong></div><Link href="/app/accounting" className="reserve-cta">See ledger <ArrowUpRight size={15} /></Link>
        </aside>
      </section>

      <section className="compliance-section">
        <div className="section-head"><div><p className="section-kicker">Compliance runway</p><h2>Know what comes next.</h2></div><span className="secondary-btn small"><CalendarClock size={15} />{obligations.length} active</span></div>
        <div className="compliance-track">
          {(obligations.length ? obligations : [
            { id: "vat", authority: "AED", obligation_type: "VAT workflow", due_date: null, amount: null, status: "future" },
            { id: "accounts", authority: "RCS", obligation_type: "Annual accounts", due_date: null, amount: null, status: "future" },
            { id: "tax", authority: "ACD", obligation_type: "Model 500", due_date: null, amount: null, status: "future" },
            { id: "rbe", authority: "RBE", obligation_type: "Beneficial owner", due_date: null, amount: null, status: "future" },
          ]).slice(0, 4).map((item, index) => (
            <article className={`compliance-card ${index === 0 && obligations.length ? "next" : item.status === "paid" || item.status === "filed" ? "done" : "future"}`} key={item.id}><div className="compliance-number">0{index + 1}</div><div className="compliance-node"><span /></div><div className="compliance-body"><span className="authority-label">{item.authority}</span><strong>{item.obligation_type.replaceAll("_", " ")}</strong><small>{item.due_date ? new Date(`${item.due_date}T12:00:00`).toLocaleDateString("en-LU", { day: "2-digit", month: "short", year: "numeric" }) : "Not scheduled yet"}</small>{item.amount != null ? <b>{money(Number(item.amount), currency)}</b> : null}</div></article>
          ))}
        </div>
      </section>

      <section className="bottom-grid">
        <article className="readiness-panel"><div><p className="section-kicker">{year} accounting readiness</p><h2>{readiness}% classified</h2><p>{rows.length === 0 ? "Record your first transaction to start measuring year-end readiness." : pendingRows.length ? `${pendingRows.length} transaction${pendingRows.length === 1 ? "" : "s"} still need accounting review.` : "All recorded transactions are posted to the ledger."}</p></div><div className="readiness-meter"><span style={{ width: `${readiness}%` }} /></div><div className="readiness-meta"><span><i className={rows.length ? "done-dot" : "wait-dot"} />{rows.length} transactions</span><span><i className={postedEntries.length ? "done-dot" : "wait-dot"} />{postedEntries.length} journal entries</span><span><i className={pendingRows.length ? "wait-dot" : "done-dot"} />{pendingRows.length} to review</span></div></article>
        <article className="assistant-panel"><div className="assistant-icon"><WalletCards size={21} /></div><div><span className="assistant-label">Receivables</span><h2>{money(Math.max(receivables, 0), currency)} outstanding.</h2><p>{invoices.filter((invoice) => invoice.payment_status !== "paid").length} issued invoice{invoices.filter((invoice) => invoice.payment_status !== "paid").length === 1 ? "" : "s"} awaiting payment.</p></div><Link href="/app/invoices">Open invoices</Link></article>
      </section>
    </div>
  );
}
