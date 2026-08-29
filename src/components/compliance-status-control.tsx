"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { updateComplianceStatus, type ComplianceState } from "@/app/app/compliance/actions";
import { useI18n } from "@/components/locale-context";
import { useRolePermissions } from "@/components/role-context";
import { UpgradeWall } from "@/components/upgrade-wall";
import styles from "./compliance-status-control.module.css";

const initial: ComplianceState = { status: "idle", message: "" };
const statuses = ["upcoming", "action_required", "ready", "filed", "paid", "not_applicable"] as const;

function label(status: string, fr: boolean) {
  const labels: Record<string, [string, string]> = {
    upcoming: ["Upcoming", "À venir"], action_required: ["Action required", "Action requise"], ready: ["Ready", "Prêt"],
    filed: ["Filed", "Déposé"], paid: ["Paid", "Payé"], overdue: ["Overdue", "En retard"], not_applicable: ["Not applicable", "Non applicable"],
  };
  return labels[status]?.[fr ? 1 : 0] ?? status.replaceAll("_", " ");
}

export function ComplianceStatusControl({ id, status }: { id: string; status: string }) {
  const { canAccount } = useRolePermissions();
  const { locale } = useI18n();
  const fr = locale === "fr";
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(updateComplianceStatus, initial);
  const [upgradeDismissed, setUpgradeDismissed] = useState(false);

  if (!canAccount) return <span className={styles.readOnly}><i />{label(status, fr)}</span>;

  return <>
    <form ref={formRef} action={action} className={styles.control}>
      <input type="hidden" name="obligation_id" value={id}/><span className={styles.statusDot}/>
      <select key={status} name="status" defaultValue={status} disabled={pending} aria-label={fr ? "Modifier le statut — enregistrement automatique" : "Change status — saves automatically"} onChange={() => { setUpgradeDismissed(false); formRef.current?.requestSubmit(); }}>
        {status === "overdue" ? <option value="overdue">{label("overdue", fr)}</option> : null}
        {statuses.map(value => <option key={value} value={value}>{label(value, fr)}</option>)}
      </select>
      <span className={styles.saveState} aria-live="polite">{pending ? <LoaderCircle className={styles.spin} size={12}/> : state.status === "success" ? <Check size={12}/> : null}</span>
      {state.status === "error" && !state.upgradeRequired ? <span className={styles.error}>{state.message}</span> : null}
    </form>
    <UpgradeWall open={Boolean(state.upgradeRequired) && !upgradeDismissed} message={state.message} locale={locale} onClose={() => setUpgradeDismissed(true)}/>
  </>;
}
