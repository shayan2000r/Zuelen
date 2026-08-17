"use client";

import { CheckCheck, LoaderCircle, XCircle } from "lucide-react";
import { useActionState } from "react";
import { bulkIgnorePendingTransactions, bulkPostSuggestedTransactions, type TransactionActionState } from "@/app/app/transactions/actions";
import styles from "./transaction-bulk-actions.module.css";

const initial: TransactionActionState = { status: "idle", message: "" };

export function TransactionBulkActions({ suggestedCount, unresolvedCount }: { suggestedCount: number; unresolvedCount: number }) {
  const [approveState, approveAction, approvePending] = useActionState(bulkPostSuggestedTransactions, initial);
  const [ignoreState, ignoreAction, ignorePending] = useActionState(bulkIgnorePendingTransactions, initial);
  const state = approveState.message ? approveState : ignoreState;
  return (
    <article className={styles.bar}>
      <div className={styles.copy}>
        <span>Batch review</span>
        <strong>{suggestedCount} suggested · {unresolvedCount} unresolved</strong>
        <p>Approve high-confidence PCN suggestions together. Ambiguous items remain for individual review.</p>
      </div>
      <div className={styles.actions}>
        <form action={approveAction}>
          <button type="submit" className={styles.primary} disabled={approvePending || suggestedCount === 0}>
            {approvePending ? <LoaderCircle className={styles.spin} size={14}/> : <CheckCheck size={14}/>}Approve all suggested
          </button>
        </form>
        <form action={ignoreAction} onSubmit={(event)=>{if(!window.confirm("Ignore every remaining unposted transaction? They will disappear from the review inbox but the bank evidence remains."))event.preventDefault();}}>
          <button type="submit" className={styles.secondary} disabled={ignorePending || (suggestedCount + unresolvedCount) === 0}>
            {ignorePending ? <LoaderCircle className={styles.spin} size={14}/> : <XCircle size={14}/>}Ignore all remaining
          </button>
        </form>
      </div>
      {state.message ? <div className={`${styles.message} ${state.status === "error" ? styles.error : ""}`}>{state.message}</div> : null}
    </article>
  );
}
