import { ArrowRight, BookOpen, CheckCircle2, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
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
      .select("id,entry_number,entry_date,description,source_type,status,posted_at")
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

  const accounts = (accountData ?? []) as Account[];
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const linesByEntry = new Map<string, JournalLine[]>();
  for (const line of lineRows) {
    const group = linesByEntry.get(line.journal_entry_id) ?? [];
    group.push(line);
    linesByEntry.set(line.journal_entry_id, group);
  }

  return (
    <div className={styles.liveWrap}>
      <div className={styles.liveIntro}>
        <div><p className={styles.eyebrow}>Double-entry ledger</p><h1>Accounting</h1><p>Posted entries are balanced and immutable. Corrections will be handled through reversal entries rather than rewriting history.</p></div>
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
            return (
              <details className={styles.journalCard} key={entry.id}>
                <summary className={styles.journalSummary}>
                  <span className={styles.journalNumber}>J{String(entry.entry_number).padStart(4, "0")}</span>
                  <span className={styles.journalCopy}><strong>{entry.description}</strong><small>{new Date(`${entry.entry_date}T12:00:00`).toLocaleDateString("en-LU", { day: "2-digit", month: "short", year: "numeric" })} · {entry.source_type}</small></span>
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
                </div>
              </details>
            );
          })}
        </section>
      )}
    </div>
  );
}
