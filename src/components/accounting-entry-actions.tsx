"use client";

import { LoaderCircle, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { voidInvoiceAction } from "@/app/app/invoices/actions";
import { editInvoicePaymentAction, undoInvoicePaymentAction } from "@/app/app/accounting/actions";
import styles from "./accounting-actions.module.css";

type State = { status: "idle" | "success" | "error"; message: string };
type InvoiceState = { status: "idle" | "success" | "error"; message: string; invoiceId: string | null };
const initial: State = { status: "idle", message: "" };
const invoiceInitial: InvoiceState = { status: "idle", message: "", invoiceId: null };

export function AccountingInvoiceActions({
  invoiceId,
  status,
  paymentStatus,
}: {
  invoiceId: string;
  status: string;
  paymentStatus: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(voidInvoiceAction, invoiceInitial);

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [router, state.status]);

  if (status !== "issued") {
    return <span className={styles.readOnly}>Voided invoice · audit history retained</span>;
  }

  const canVoid = paymentStatus === "unpaid";
  return (
    <div className={styles.actions}>
      <Link href={`/app/invoices/${invoiceId}/correct`} className={styles.button}><Pencil size={13} />Edit invoice</Link>
      <form action={action} onSubmit={(event) => {
        if (!canVoid) {
          event.preventDefault();
          return;
        }
        if (!window.confirm("Delete this issued invoice? Zuelen will reverse the receivable, revenue and VAT entry and keep the audit trail.")) event.preventDefault();
      }}>
        <input type="hidden" name="invoice_id" value={invoiceId} />
        <button className={`${styles.button} ${styles.danger}`} type="submit" disabled={pending || !canVoid} title={canVoid ? "Void invoice" : "Undo its payment first"}>
          {pending ? <LoaderCircle className={styles.spin} size={13} /> : <Trash2 size={13} />}Delete
        </button>
      </form>
      {!canVoid ? <span className={styles.hint}>Undo the payment entry first to delete this invoice.</span> : null}
      {state.status === "error" ? <span className={styles.error}>{state.message}</span> : null}
    </div>
  );
}

export function AccountingPaymentActions({ payment }: {
  payment: {
    id: string;
    amount: number | string;
    paid_on: string;
    reference: string | null;
    bank_transaction_id: string | null;
  };
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [editState, editAction, editPending] = useActionState(editInvoicePaymentAction, initial);
  const [undoState, undoAction, undoPending] = useActionState(undoInvoicePaymentAction, initial);
  const matched = Boolean(payment.bank_transaction_id);

  useEffect(() => {
    if (editState.status === "success") {
      dialog.current?.close();
      router.refresh();
    }
  }, [editState.status, router]);
  useEffect(() => {
    if (undoState.status === "success") router.refresh();
  }, [router, undoState.status]);

  return (
    <div className={styles.actions}>
      <button className={styles.button} type="button" onClick={() => dialog.current?.showModal()} disabled={matched} title={matched ? "Edit this from bank reconciliation" : "Edit payment"}><Pencil size={13} />Edit payment</button>
      <form action={undoAction} onSubmit={(event) => {
        if (!window.confirm(matched ? "Undo this matched payment? The bank transaction will become unmatched and Zuelen will reverse the payment journal entry." : "Undo this payment? Zuelen will reverse its journal entry and restore the invoice receivable.")) event.preventDefault();
      }}>
        <input type="hidden" name="payment_id" value={payment.id} />
        <button className={`${styles.button} ${styles.danger}`} type="submit" disabled={undoPending}>{undoPending ? <LoaderCircle className={styles.spin} size={13} /> : <RotateCcw size={13} />}Undo payment</button>
      </form>
      {matched ? <span className={styles.hint}>Matched bank payments can be undone here; edit their amount from bank reconciliation.</span> : null}
      {undoState.status === "error" ? <span className={styles.error}>{undoState.message}</span> : null}

      <dialog ref={dialog} className={styles.dialog}>
        <form action={editAction} className={styles.dialogCard}>
          <div className={styles.dialogHead}><div><span>Accounting-safe correction</span><h3>Edit payment</h3></div><button type="button" onClick={() => dialog.current?.close()}><X size={16} /></button></div>
          <p className={styles.notice}>The existing payment journal entry will stay in history. Zuelen reverses it and posts the corrected payment automatically.</p>
          <input type="hidden" name="payment_id" value={payment.id} />
          <div className={styles.grid}>
            <label><span>Amount</span><input name="amount" type="number" min="0.01" step="0.01" defaultValue={Number(payment.amount).toFixed(2)} required /></label>
            <label><span>Payment date</span><input name="paid_on" type="date" defaultValue={payment.paid_on} required /></label>
            <label className={styles.full}><span>Reference</span><input name="reference" defaultValue={payment.reference ?? ""} placeholder="Optional payment reference" /></label>
          </div>
          {editState.status === "error" ? <div className={styles.dialogError}>{editState.message}</div> : null}
          <div className={styles.dialogFooter}><button type="button" className={styles.secondary} onClick={() => dialog.current?.close()}>Cancel</button><button type="submit" className={styles.primary} disabled={editPending}>{editPending ? <LoaderCircle className={styles.spin} size={14} /> : <Pencil size={14} />}{editPending ? "Correcting…" : "Save correction"}</button></div>
        </form>
      </dialog>
    </div>
  );
}

export function AccountingReadOnlyAction({ children }: { children: string }) {
  return <span className={styles.readOnly}>{children}</span>;
}
