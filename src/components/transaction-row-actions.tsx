"use client";

import { LoaderCircle, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { deleteSourceTransactionAction, editSourceTransactionAction, type TransactionActionState } from "@/app/app/transactions/actions";
import styles from "./record-actions.module.css";

type Row = {
  id: string;
  occurred_on: string;
  direction: string;
  amount_gross: number | string;
  vat_amount: number | string | null;
  counterparty_name: string | null;
  description: string | null;
  classification_status: string;
};

const initial: TransactionActionState = { status: "idle", message: "" };

export function TransactionRowActions({ row }: { row: Row }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [editState, editAction, editPending] = useActionState(editSourceTransactionAction, initial);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteSourceTransactionAction, initial);

  useEffect(() => {
    if (editState.status === "success") {
      dialog.current?.close();
      router.refresh();
    }
  }, [editState.status, router]);
  useEffect(() => {
    if (deleteState.status === "success") router.refresh();
  }, [deleteState.status, router]);

  const posted = row.classification_status === "posted";

  return (
    <div className={styles.actions}>
      <button type="button" className={styles.iconButton} onClick={() => dialog.current?.showModal()} aria-label="Edit transaction"><Pencil size={13} /></button>
      <form action={deleteAction} onSubmit={(event) => {
        if (!window.confirm(posted ? "Delete this posted transaction? Compta will create a reversal so the ledger remains auditable." : "Delete this transaction?")) event.preventDefault();
      }}>
        <input type="hidden" name="source_transaction_id" value={row.id} />
        <button type="submit" className={`${styles.iconButton} ${styles.danger}`} disabled={deletePending} aria-label="Delete transaction">{deletePending ? <LoaderCircle className={styles.spin} size={13} /> : <Trash2 size={13} />}</button>
      </form>
      <dialog ref={dialog} className={styles.dialog}>
        <form action={editAction} className={styles.dialogCard}>
          <div className={styles.dialogHead}><div><span>{posted ? "Accounting-safe correction" : "Edit transaction"}</span><h3>{posted ? "Correct posted transaction" : "Update transaction"}</h3></div><button type="button" onClick={() => dialog.current?.close()}><X size={16} /></button></div>
          {posted ? <p className={styles.notice}>The original journal entry stays immutable. Compta will reverse it and repost the corrected values automatically.</p> : null}
          <input type="hidden" name="source_transaction_id" value={row.id} />
          <div className={styles.grid}>
            <label><span>Type</span><select name="direction" defaultValue={row.direction}><option value="expense">Expense</option><option value="income">Income</option></select></label>
            <label><span>Date</span><input name="occurred_on" type="date" defaultValue={row.occurred_on} required /></label>
            <label><span>Gross amount</span><input name="amount_gross" type="number" min="0.01" step="0.01" defaultValue={Number(row.amount_gross).toFixed(2)} required /></label>
            <label><span>VAT included</span><input name="vat_amount" type="number" min="0" step="0.01" defaultValue={Number(row.vat_amount ?? 0).toFixed(2)} /></label>
            <label className={styles.full}><span>Customer / supplier</span><input name="counterparty_name" defaultValue={row.counterparty_name ?? ""} /></label>
            <label className={styles.full}><span>Description</span><textarea name="description" defaultValue={row.description ?? ""} /></label>
          </div>
          {editState.status === "error" ? <div className={styles.error}>{editState.message}</div> : null}
          <div className={styles.dialogFooter}><button type="button" className={styles.secondary} onClick={() => dialog.current?.close()}>Cancel</button><button type="submit" className={styles.primary} disabled={editPending}>{editPending ? <LoaderCircle className={styles.spin} size={14} /> : <Pencil size={14} />}{editPending ? "Saving…" : "Save changes"}</button></div>
        </form>
      </dialog>
      {deleteState.status === "error" ? <span className={styles.inlineError}>{deleteState.message}</span> : null}
    </div>
  );
}
