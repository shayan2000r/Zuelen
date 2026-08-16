"use client";

import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Landmark, LoaderCircle, LockKeyhole } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { initialTransactionState, postSourceTransaction } from "@/app/app/transactions/actions";
import styles from "./live.module.css";

type Account = {
  id: string;
  code: string;
  label: string;
  account_type: string;
};

type Transaction = {
  id: string;
  occurred_on: string;
  direction: string;
  amount_gross: number | string;
  amount_net: number | string | null;
  vat_amount: number | string | null;
  currency: string;
  counterparty_name: string | null;
  description: string | null;
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-LU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function TransactionReviewCard({ transaction, accounts }: { transaction: Transaction; accounts: Account[] }) {
  const income = transaction.direction === "income";
  const eligible = useMemo(
    () => accounts.filter((account) => income ? account.account_type === "revenue" : ["expense", "asset"].includes(account.account_type)),
    [accounts, income],
  );
  const preferred = income ? "7033" : "6188";
  const initialCode = eligible.find((account) => account.code === preferred)?.code ?? eligible[0]?.code ?? "";
  const [accountCode, setAccountCode] = useState(initialCode);
  const [state, formAction, pending] = useActionState(postSourceTransaction, initialTransactionState);
  const selected = eligible.find((account) => account.code === accountCode);
  const gross = Number(transaction.amount_gross);
  const vat = Number(transaction.vat_amount ?? 0);
  const net = Number(transaction.amount_net ?? gross - vat);
  const title = transaction.counterparty_name || transaction.description || (income ? "Income transaction" : "Expense transaction");

  return (
    <article className={styles.reviewCard}>
      <div className={styles.reviewTop}>
        <div>
          <p className={styles.eyebrow}>Next to review</p>
          <h2>{title}</h2>
          <span>{new Date(`${transaction.occurred_on}T12:00:00`).toLocaleDateString("en-LU", { day: "2-digit", month: "long", year: "numeric" })}</span>
        </div>
        <div className={income ? styles.reviewIncome : styles.reviewExpense}>
          {income ? <ArrowUpRight size={15} /> : <ArrowDownLeft size={15} />}
          {income ? "+" : "−"}{money(gross, transaction.currency)}
        </div>
      </div>

      <div className={styles.reviewMetaGrid}>
        <div><span>Net</span><strong>{money(net, transaction.currency)}</strong></div>
        <div><span>VAT</span><strong>{money(vat, transaction.currency)}</strong></div>
        <div><span>Settlement</span><strong>Bank · 5131</strong></div>
      </div>

      <form action={formAction} className={styles.reviewForm}>
        <input type="hidden" name="source_transaction_id" value={transaction.id} />
        <label>
          <span>Accounting category</span>
          <select name="account_code" value={accountCode} onChange={(event) => setAccountCode(event.target.value)} disabled={pending || eligible.length === 0}>
            {eligible.map((account) => (
              <option value={account.code} key={account.id}>{account.code} · {account.label}</option>
            ))}
          </select>
        </label>

        {selected ? (
          <div className={styles.postingPreview}>
            <div className={styles.previewTitle}><Landmark size={14} /><span>Posting preview</span><small>{selected.account_type === "asset" ? "Capitalised" : "P&L"}</small></div>
            {income ? (
              <>
                <div className={styles.postingLine}><span><b>5131</b> Bank</span><strong>Dr {money(gross, transaction.currency)}</strong></div>
                <div className={styles.postingLine}><span><b>{selected.code}</b> {selected.label}</span><strong>Cr {money(net, transaction.currency)}</strong></div>
                {vat > 0 ? <div className={styles.postingLine}><span><b>461411</b> Output VAT</span><strong>Cr {money(vat, transaction.currency)}</strong></div> : null}
              </>
            ) : (
              <>
                <div className={styles.postingLine}><span><b>{selected.code}</b> {selected.label}</span><strong>Dr {money(net, transaction.currency)}</strong></div>
                {vat > 0 ? <div className={styles.postingLine}><span><b>421611</b> Input VAT</span><strong>Dr {money(vat, transaction.currency)}</strong></div> : null}
                <div className={styles.postingLine}><span><b>5131</b> Bank</span><strong>Cr {money(gross, transaction.currency)}</strong></div>
              </>
            )}
            <div className={styles.previewBalance}><CheckCircle2 size={13} />Debits and credits balance to {money(gross, transaction.currency)}</div>
          </div>
        ) : null}

        {state.message ? <div className={`${styles.reviewMessage} ${state.status === "error" ? styles.reviewError : ""}`}>{state.message}</div> : null}
        <button className={styles.reviewButton} type="submit" disabled={pending || !selected}>
          {pending ? <LoaderCircle className={styles.reviewSpinner} size={15} /> : <LockKeyhole size={15} />}
          <span>{pending ? "Posting…" : "Post to ledger"}</span>
        </button>
      </form>
    </article>
  );
}
