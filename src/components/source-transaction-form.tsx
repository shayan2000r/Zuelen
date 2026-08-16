"use client";

import { LoaderCircle, Plus, ReceiptText } from "lucide-react";
import { useActionState } from "react";
import { createSourceTransaction, type TransactionActionState } from "@/app/app/transactions/actions";
import styles from "./live.module.css";

const initialTransactionState: TransactionActionState = { status: "idle", message: "" };

export function SourceTransactionForm() {
  const [state, formAction, pending] = useActionState(createSourceTransaction, initialTransactionState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <aside className={styles.formPanel}>
      <p className={styles.eyebrow}>Record activity</p>
      <h2>New transaction</h2>
      <p>Capture what happened first. Classification and posting come next, so you never have to guess an accounting account at entry time.</p>
      <form action={formAction} className={styles.transactionForm}>
        <label className={styles.field}><span>Type</span><select name="direction" defaultValue="expense" required><option value="expense">Expense</option><option value="income">Income</option></select></label>
        <label className={styles.field}><span>Date</span><input name="occurred_on" type="date" defaultValue={today} required /></label>
        <label className={styles.field}><span>Gross amount</span><input name="amount_gross" type="number" min="0.01" step="0.01" placeholder="0.00" required /></label>
        <label className={styles.field}><span>VAT included</span><input name="vat_amount" type="number" min="0" step="0.01" defaultValue="0.00" /></label>
        <label className={`${styles.field} ${styles.fieldFull}`}><span>Customer / supplier</span><input name="counterparty_name" placeholder="e.g. Software supplier" /></label>
        <label className={`${styles.field} ${styles.fieldFull}`}><span>Description</span><textarea name="description" placeholder="What was this transaction for?" /></label>
        {state.message ? <div className={`${styles.formMessage} ${state.status === "error" ? styles.formError : ""}`}>{state.message}</div> : null}
        <button className={styles.submitButton} type="submit" disabled={pending}>{pending ? <LoaderCircle size={15} /> : state.status === "success" ? <ReceiptText size={15} /> : <Plus size={15} />}<span>{pending ? "Recording…" : "Record transaction"}</span></button>
      </form>
    </aside>
  );
}
