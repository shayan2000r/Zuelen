"use client";

import { CheckCheck, LoaderCircle, Sparkles, XCircle } from "lucide-react";
import { useActionState } from "react";
import type { TransactionActionState } from "@/app/app/transactions/actions";
import { aiReanalyzePendingTransactions, approveSuggestedForActiveYear, ignorePendingForActiveYear } from "@/app/app/transactions/ai-actions";
import styles from "./transaction-bulk-actions.module.css";

const initial: TransactionActionState = { status: "idle", message: "" };

export function TransactionBulkActions({ suggestedCount, unresolvedCount }: { suggestedCount: number; unresolvedCount: number }) {
  const [aiState, aiAction, aiPending] = useActionState(aiReanalyzePendingTransactions, initial);
  const [approveState, approveAction, approvePending] = useActionState(approveSuggestedForActiveYear, initial);
  const [ignoreState, ignoreAction, ignorePending] = useActionState(ignorePendingForActiveYear, initial);
  const state = aiState.message ? aiState : approveState.message ? approveState : ignoreState;
  return (
    <article className={styles.bar}>
      <div className={styles.copy}>
        <span>Smart bookkeeping</span>
        <strong>{suggestedCount} suggested · {unresolvedCount} unresolved</strong>
        <p>Rules handle known patterns first. AI can inspect the remaining bank evidence, auto-post exceptionally clear operating items, and leave genuine ambiguity for you.</p>
      </div>
      <div className={styles.actions}>
        <form action={aiAction}>
          <button type="submit" className={styles.primary} disabled={aiPending || (suggestedCount + unresolvedCount) === 0}>
            {aiPending ? <LoaderCircle className={styles.spin} size={14}/> : <Sparkles size={14}/>} {aiPending ? "Analysing…" : "Re-analyse with AI"}
          </button>
        </form>
        <form action={approveAction}>
          <button type="submit" className={styles.secondary} disabled={approvePending || suggestedCount === 0}>
            {approvePending ? <LoaderCircle className={styles.spin} size={14}/> : <CheckCheck size={14}/>}Approve suggested
          </button>
        </form>
        <form action={ignoreAction} onSubmit={(event)=>{if(!window.confirm("Ignore every remaining transaction in the selected financial year? They will disappear from the review inbox but the bank evidence remains."))event.preventDefault();}}>
          <button type="submit" className={styles.secondary} disabled={ignorePending || (suggestedCount + unresolvedCount) === 0}>
            {ignorePending ? <LoaderCircle className={styles.spin} size={14}/> : <XCircle size={14}/>}Ignore remaining
          </button>
        </form>
      </div>
      {state.message ? <div className={`${styles.message} ${state.status === "error" ? styles.error : ""}`}>{state.message}</div> : null}
    </article>
  );
}
