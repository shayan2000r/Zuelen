"use client";

import { CheckCheck, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import type { TransactionActionState } from "@/app/app/transactions/actions";
import { approveSuggestedForActiveYear } from "@/app/app/transactions/ai-actions";
import styles from "./transaction-bulk-actions.module.css";

const initial: TransactionActionState = { status: "idle", message: "" };

export function TransactionBulkActions({ suggestedCount, safeBulkCount, locale="en" }: { suggestedCount: number; safeBulkCount:number; locale?:"en"|"fr" }) {
  const fr=locale==="fr";
  const [approveState, approveAction, approvePending] = useActionState(approveSuggestedForActiveYear, initial);
  if(!suggestedCount)return null;
  return <div className={styles.inline}>
    <Link className={styles.review} href="/app/transactions?status=suggestions">{fr?"Voir":"Review"}</Link>
    {safeBulkCount?<form action={approveAction}><button type="submit" className={styles.approve} disabled={approvePending} title={fr?`Approuver ${safeBulkCount} suggestions sûres`:`Approve ${safeBulkCount} safe suggestions`}>{approvePending?<LoaderCircle className={styles.spin} size={13}/>:<CheckCheck size={13}/>}<span>{approvePending?(fr?"…":"…"):(fr?`Approuver ${safeBulkCount}`:`Approve ${safeBulkCount}`)}</span></button></form>:null}
    {approveState.status==="error"&&approveState.message?<span className={styles.error} role="alert">{approveState.message}</span>:null}
  </div>;
}
