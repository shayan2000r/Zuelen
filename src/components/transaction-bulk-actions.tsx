"use client";

import { CheckCheck, CircleHelp, LoaderCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import type { TransactionActionState } from "@/app/app/transactions/actions";
import { approveSuggestedForActiveYear } from "@/app/app/transactions/ai-actions";
import styles from "./transaction-bulk-actions.module.css";

const initial: TransactionActionState = { status: "idle", message: "" };

export function TransactionBulkActions({ suggestedCount, unresolvedCount, safeBulkCount, locale="en" }: { suggestedCount: number; unresolvedCount: number; safeBulkCount:number; locale?:"en"|"fr" }) {
  const fr=locale==="fr";
  const [approveState, approveAction, approvePending] = useActionState(approveSuggestedForActiveYear, initial);
  return (
    <article className={styles.bar}>
      <div className={styles.copy}>
        <span>{fr?"File de vérification":"Review queue"}</span>
        <strong>{fr?`${suggestedCount} suggestion${suggestedCount===1?"":"s"} · ${unresolvedCount} à préciser`:`${suggestedCount} suggestion${suggestedCount===1?"":"s"} · ${unresolvedCount} need your input`}</strong>
        <p>{fr?"Zuelen a déjà analysé les mouvements. Vérifiez les catégories proposées ou décrivez simplement les transactions qui restent ambiguës.":"Zuelen has already analysed the movements. Review the proposed categories or simply describe the transactions that still need context."}</p>
      </div>
      <div className={styles.actions}>
        {suggestedCount?<Link className={styles.secondary} href="/app/transactions?status=suggestions"><Sparkles size={14}/>{fr?"Voir les suggestions":"Review suggestions"}</Link>:null}
        {unresolvedCount?<Link className={styles.secondary} href="/app/transactions?status=review"><CircleHelp size={14}/>{fr?"À vérifier":"Needs review"}</Link>:null}
        {safeBulkCount?<form action={approveAction}><button type="submit" className={styles.primary} disabled={approvePending}>{approvePending?<LoaderCircle className={styles.spin} size={14}/>:<CheckCheck size={14}/>} {approvePending?(fr?"Comptabilisation…":"Posting…"):(fr?`Approuver ${safeBulkCount} très fiables`:`Approve ${safeBulkCount} high-confidence`)}</button></form>:null}
      </div>
      {approveState.message ? <div className={`${styles.message} ${approveState.status === "error" ? styles.error : ""}`}>{approveState.message}</div> : null}
    </article>
  );
}
