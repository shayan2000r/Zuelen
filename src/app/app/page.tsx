import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Landmark, Plus, ReceiptText, ShieldCheck, Upload, WalletCards } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OverviewAssistant } from "@/components/overview-assistant";
import { OverviewChart } from "@/components/overview-chart";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import styles from "./overview.module.css";

export const dynamic = "force-dynamic";
type LedgerLine = { journal_entry_id: string; company_account_id: string; debit: number | string; credit: number | string };
type LedgerAccount = { id: string; code: string; account_type: string };

type TrendTone = "accent" | "dark" | "positive" | "warning" | "hero";

function money(value: number, currency = "EUR") {
  return new Intl.NumberFormat("en-LU", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function title(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase()); }

function MiniTrend({ values, tone = "accent" }: { values: number[]; tone?: TrendTone }) {
  const width = 120, height = tone === "hero" ? 58 : 42;
  const min = Math.min(...values, 0), max = Math.max(...values, 1), span = Math.max(1, max - min);
  const points = values.map((value, index) => {
    const x = values.length <= 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - 5 - ((value - min) / span) * (height - 10);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const area = `0,${height} ${points} ${width},${height}`;
  const toneClass = tone === "dark" ? styles.trendDark : tone === "positive" ? styles.trendPositive : tone === "warning" ? styles.trendWarning : tone === "hero" ? styles.trendHero : styles.trendAccent;
  return <svg className={`${styles.miniTrend} ${toneClass}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true"><polygon points={area} className={styles.sparkArea}/><polyline points={points} className={styles.sparkLine}/></svg>;
}

function PulseRing({ value, display, label, negative = false }: { value: number; display: string; label: string; negative?: boolean }) {
  const normalized = clamp(value, 0, 100);
  const color = negative ? "#a65340" : "#25a244";
  return <div className={styles.pulseMetric}><div className={styles.pulseRing} style={{ background: `conic-gradient(${color} ${normalized * 3.6}deg,#edf2ee 0deg)` }}><div><strong>{display}</strong><span>{label}</span></div></div></div>;
}

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
    supabase.from("journal_entries").select("id,entry_number,entry_date").eq("company_id", workspace.company.id).eq("status", "posted").gte("entry_date", `${year}-01-01`).lte("entry_date", `${year}-12-31`),
    supabase.from("company_accounts").select("id,code,account_type").eq("company_id", workspace.company.id),
    supabase.from("sales_invoices").select("id,invoice_number,total,due_date,payment_status,customer_snapshot").eq("company_id", workspace.company.id).eq("status", "issued").order("due_date", { ascending: true }),
    supabase.from("compliance_obligations").select("id,authority,obligation_type,due_date,amount,currency,status,period_label").eq("company_id", workspace.company.id).not("status", "in", "(paid,filed,not_applicable)").order("due_date", { ascending: true, nullsFirst: false }).limit(16),
  ]);
  for (const result of [transactionsResult, entriesResult, accountsResult, invoicesResult, obligationsResult]) if (result.error) throw new Error(result.error.message);

  const rows = transactionsResult.data ?? [];
  const entries = entriesResult.data ?? [];
  const accounts = (accountsResult.data ?? []) as LedgerAccount[];
  const invoices = invoicesResult.data ?? [];
  const obligations = obligationsResult.data ?? [];
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const entryDateMap = new Map(entries.map((entry) => [entry.id, entry.entry_date]));
  const monthly = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));
  const monthlyVat = Array.from({ length: 12 }, () => 0);
  const monthlyBankDelta = Array.from({ length: 12 }, () => 0);

  let lines: LedgerLine[] = [];
  if (entries.length) {
    const result = await supabase.from("journal_lines").select("journal_entry_id,company_account_id,debit,credit").in("journal_entry_id", entries.map((entry) => entry.id));
    if (result.error) throw new Error(result.error.message);
    lines = (result.data ?? []) as LedgerLine[];
  }

  let revenue = 0, expenses = 0, outputVat = 0, inputVat = 0, bank = 0, receivables = 0;
  for (const line of lines) {
    const account = accountMap.get(line.company_account_id);
    if (!account) continue;
    const debit = Number(line.debit), credit = Number(line.credit);
    const entryDate = entryDateMap.get(line.journal_entry_id);
    const month = entryDate ? Number(entryDate.slice(5, 7)) - 1 : -1;
    if (account.account_type === "revenue") {
      const value = credit - debit;
      revenue += value;
      if (month >= 0 && month < 12) monthly[month].income += value;
    }
    if (account.account_type === "expense") {
      const value = debit - credit;
      expenses += value;
      if (month >= 0 && month < 12) monthly[month].expense += value;
    }
    if (account.code === "461411") {
      const value = credit - debit;
      outputVat += value;
      if (month >= 0 && month < 12) monthlyVat[month] += value;
    }
    if (account.code === "421611") {
      const value = debit - credit;
      inputVat += value;
      if (month >= 0 && month < 12) monthlyVat[month] -= value;
    }
    if (account.code === "5131") {
      const value = debit - credit;
      bank += value;
      if (month >= 0 && month < 12) monthlyBankDelta[month] += value;
    }
    if (account.code === "4011") receivables += debit - credit;
  }

  const pending = rows.filter((row) => row.classification_status !== "posted");
  for (const row of pending) {
    const net = Number(row.amount_net ?? row.amount_gross ?? 0), vatAmount = Number(row.vat_amount ?? 0);
    const month = Number(row.occurred_on.slice(5, 7)) - 1;
    if (row.direction === "income") {
      revenue += net;
      outputVat += vatAmount;
      if (month >= 0 && month < 12) { monthly[month].income += net; monthlyVat[month] += vatAmount; }
    } else {
      expenses += net;
      inputVat += vatAmount;
      if (month >= 0 && month < 12) { monthly[month].expense += net; monthlyVat[month] -= vatAmount; }
    }
  }

  const profit = revenue - expenses;
  const vat = outputVat - inputVat;
  const reserve = Math.max(vat, 0);
  const safe = bank - reserve;
  const reservePct = bank > 0 ? clamp(Math.round((reserve / bank) * 100), 0, 100) : 0;
  const readiness = rows.length ? Math.round(((rows.length - pending.length) / rows.length) * 100) : 100;
  const profitMargin = revenue ? (profit / revenue) * 100 : 0;
  const overdue = invoices.filter((invoice) => invoice.payment_status !== "paid" && invoice.due_date && new Date(`${invoice.due_date}T23:59:59`) < now);
  const attention = pending.length + overdue.length;
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const recentRows = rows.slice(0, 4);
  const profitMonthly = monthly.map((month) => month.income - month.expense);
  let runningBank = 0;
  const bankTrend = monthlyBankDelta.map((delta) => (runningBank += delta));

  const monthIndex = now.getMonth();
  const firstDayOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const calendarCells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstDayOffset + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
  const dueDays = new Map<number, typeof obligations>();
  for (const obligation of obligations) {
    if (!obligation.due_date) continue;
    const date = new Date(`${obligation.due_date}T12:00:00`);
    if (date.getFullYear() === year && date.getMonth() === monthIndex) {
      const day = date.getDate();
      dueDays.set(day, [...(dueDays.get(day) ?? []), obligation]);
    }
  }
  const nextObligation = obligations.find((obligation) => obligation.due_date) ?? obligations[0] ?? null;

  return (
    <div className={styles.page}>
      <header className={styles.welcome}>
        <div>
          <p className={styles.eyebrow}>{now.toLocaleDateString("en-LU", { weekday: "long", day: "2-digit", month: "long" })}</p>
          <h1>{greeting} <span>{workspace.company.legal_name}</span>.</h1>
          <p>{attention ? `${attention} ${attention === 1 ? "item needs" : "items need"} your attention.` : "Everything important is under control."}</p>
        </div>
      </header>

      <section className={styles.topGrid}>
        <article className={styles.balanceCard}>
          <div className={styles.balanceTop}>
            <div><span className={styles.cardLabel}>Book cash</span><small>Ledger account 5131</small></div>
            <span className={styles.currencyPill}>{currency}</span>
          </div>
          <div className={styles.balanceHero}>
            <div><strong className={styles.balanceAmount}>{money(bank, currency)}</strong><div className={styles.balanceSignal}><span className={bank >= 0 ? styles.signalGood : styles.signalBad}>{bank >= 0 ? "Available" : "Overdrawn"}</span></div></div>
            <div className={styles.balanceTrend}><MiniTrend values={bankTrend} tone="hero" /><span>Cash movement · YTD</span></div>
          </div>
          <div className={styles.quickActions}>
            <Link className={styles.primaryQuick} href="/app/transactions"><Plus size={14} />Add activity</Link>
            <Link className={styles.secondaryQuick} href="/app/banking"><Upload size={14} />Import bank CSV</Link>
          </div>
          <div className={styles.balanceBreakdown}>
            <div><span>Safe to use</span><strong className={safe >= 0 ? styles.positiveText : styles.negativeText}>{money(safe, currency)}</strong></div>
            <div><span>Tax reserve</span><strong>{money(reserve, currency)}</strong><small>{reservePct}% of cash</small></div>
            <div><span>Receivables</span><strong>{money(receivables, currency)}</strong></div>
          </div>
        </article>

        <section className={styles.metricCluster} aria-label="Financial highlights">
          <article className={`${styles.metricTile} ${styles.metricAccent}`}>
            <div className={styles.metricHead}><span>Total revenue</span><WalletCards size={15} /></div>
            <strong>{money(revenue, currency)}</strong>
            <MiniTrend values={monthly.map((month) => month.income)} tone="accent" />
          </article>
          <article className={styles.metricTile}>
            <div className={styles.metricHead}><span>Total spending</span><ReceiptText size={15} /></div>
            <strong>{money(expenses, currency)}</strong>
            <MiniTrend values={monthly.map((month) => month.expense)} tone="dark" />
          </article>
          <article className={styles.metricTile}>
            <div className={styles.metricHead}><span>Estimated profit</span><ArrowUpRight size={15} /></div>
            <strong className={profit >= 0 ? styles.positiveText : styles.negativeText}>{money(profit, currency)}</strong>
            <MiniTrend values={profitMonthly} tone={profit >= 0 ? "positive" : "warning"} />
          </article>
          <article className={styles.metricTile}>
            <div className={styles.metricHead}><span>VAT position</span><Landmark size={15} /></div>
            <strong>{money(vat, currency)}</strong>
            <MiniTrend values={monthlyVat} tone="positive" />
          </article>
        </section>

        <OverviewChart monthly={monthly} currency={currency} year={year} currentMonth={now.getMonth()} />
      </section>

      <section className={styles.visualGrid}>
        <article className={styles.pulseCard}>
          <div className={styles.pulseHead}><div><span className={styles.cardLabel}>Business pulse</span><h2>At a glance</h2></div><ShieldCheck size={17}/></div>
          <div className={styles.pulseRings}>
            <PulseRing value={Math.max(0, profitMargin)} display={`${Math.round(profitMargin)}%`} label="Margin" negative={profitMargin < 0}/>
            <PulseRing value={readiness} display={`${readiness}%`} label="Books ready" />
          </div>
          <div className={styles.queueStrip}><span><i className={pending.length ? styles.queueWarning : styles.queueGood}/>{pending.length} to review</span><span>{overdue.length} overdue invoice{overdue.length === 1 ? "" : "s"}</span></div>
        </article>

        <article className={styles.calendarCard}>
          <div className={styles.calendarHead}>
            <div><span className={styles.cardLabel}>Compliance calendar</span><h2>{now.toLocaleDateString("en-LU", { month: "long", year: "numeric" })}</h2></div>
            <Link href="/app/compliance">Open</Link>
          </div>
          <div className={styles.weekdays}>{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
          <div className={styles.calendarGrid}>
            {calendarCells.map((day, index) => {
              const dayObligations = day ? dueDays.get(day) ?? [] : [];
              const isToday = day === now.getDate();
              return day ? (
                <Link href="/app/compliance" key={`${day}-${index}`} className={`${styles.calendarDay} ${isToday ? styles.calendarToday : ""} ${dayObligations.length ? styles.calendarDue : ""}`} title={dayObligations.map((obligation) => title(obligation.obligation_type)).join(", ") || undefined}>
                  <span>{day}</span>{dayObligations.length ? <i /> : null}
                </Link>
              ) : <span className={styles.calendarBlank} key={`blank-${index}`} />;
            })}
          </div>
          <div className={styles.calendarNext}>
            {nextObligation ? <><span>Next</span><strong>{title(nextObligation.obligation_type)}</strong><b>{nextObligation.due_date ? new Date(`${nextObligation.due_date}T12:00:00`).toLocaleDateString("en-LU", { day: "2-digit", month: "short" }) : "Open"}</b></> : <><CheckCircle2 size={14} /><strong>No open obligations.</strong></>}
          </div>
        </article>

        <OverviewAssistant />
      </section>

      <article className={styles.activityCard}>
        <div className={styles.activityHead}>
          <div><span className={styles.cardLabel}>Recent activity</span><h2>Latest transactions</h2></div>
          <div className={styles.activityTools}><span>{pending.length} need review</span><Link href="/app/transactions">View all</Link></div>
        </div>
        {recentRows.length === 0 ? <div className={styles.activityEmpty}><ReceiptText size={20} /><strong>No activity yet</strong></div> : <div className={styles.activityRows}>{recentRows.map((row) => {
          const income = row.direction === "income", posted = row.classification_status === "posted";
          return <Link href="/app/transactions" className={styles.activityRow} key={row.id}>
            <span className={`${styles.activityIcon} ${income ? styles.activityIconIn : styles.activityIconOut}`}>{income ? <ArrowUpRight size={14}/> : <ArrowDownLeft size={14}/>}</span>
            <span className={styles.activityName}><strong>{row.counterparty_name || row.description || (income ? "Income" : "Expense")}</strong><small>{new Date(`${row.occurred_on}T12:00:00`).toLocaleDateString("en-LU", { day: "2-digit", month: "short" })} · {posted ? "Posted" : "Review"}</small></span>
            <span className={`${styles.activityStatus} ${posted ? styles.statusPosted : styles.statusReview}`}><i />{posted ? "Posted" : "Review"}</span>
            <b className={income ? styles.incomeAmount : styles.expenseAmount}>{income ? "+" : "−"}{money(Number(row.amount_gross), row.currency)}</b>
          </Link>;
        })}</div>}
      </article>

      <footer className={styles.footer}><span>Compta · Luxembourg-first accounting</span><span>Live ledger · {year}</span></footer>
    </div>
  );
}
