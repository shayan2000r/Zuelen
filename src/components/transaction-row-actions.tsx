"use client";

import { Calculator, LoaderCircle, Pencil, RefreshCcw, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteSourceTransactionAction,
  editSourceTransactionAction,
  recategorizeSourceTransactionAction,
  type TransactionActionState,
} from "@/app/app/transactions/actions";
import { TransactionEvidenceAction } from "@/components/transaction-evidence-action";
import { TransactionHistoryAction } from "@/components/transaction-history-action";
import styles from "./record-actions.module.css";
import { closestVatRate, vatRatesOn } from "@/lib/tax-rules/vat";
import { computeTransactionVat } from "@/lib/tax-rules/transaction-vat";

type Account = { id: string; code: string; label: string; account_type: string };
type Evidence = { id: string; file_name: string; type: string; file_size: number | null; created_at: string };
type AuditEvent = {
  id: number;
  event_type: string;
  actor_user_id: string | null;
  actor_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};
type Row = {
  id: string;
  occurred_on: string;
  direction: string;
  amount_gross: number | string;
  amount_net?: number | string | null;
  vat_amount: number | string | null;
  vat_rate?: number | string | null;
  vat_treatment?: string | null;
  counterparty_country?: string | null;
  counterparty_name: string | null;
  description: string | null;
  classification_status: string;
  suggested_account_id?: string | null;
  currency?: string;
  evidence?: Evidence[];
  history?: AuditEvent[];
};
const initial: TransactionActionState = { status: "idle", message: "" };
function inferredRate(gross: number, vat: number, date: string) {
  const net = gross - vat;
  if (vat <= 0 || net <= 0) return 0;
  return closestVatRate((vat / net) * 100, date);
}
function money(v: number, currency = "EUR") {
  return new Intl.NumberFormat("en-LU", { style: "currency", currency, minimumFractionDigits: 2 }).format(v || 0);
}

export function TransactionRowActions({ row, accounts = [] }: { row: Row; accounts?: Account[] }) {
  const dialog = useRef<HTMLDialogElement>(null),
    router = useRouter();
  const [editState, editAction, editPending] = useActionState(editSourceTransactionAction, initial),
    [deleteState, deleteAction, deletePending] = useActionState(deleteSourceTransactionAction, initial),
    [categoryState, categoryAction, categoryPending] = useActionState(recategorizeSourceTransactionAction, initial);
  const gross = Number(row.amount_gross),
    existingVat = Number(row.vat_amount ?? 0),
    defaultRate = Number(row.vat_rate ?? inferredRate(gross, existingVat, row.occurred_on)),
    defaultTreatment = row.vat_treatment ?? "domestic";
  const [amount, setAmount] = useState(gross),
    [rate, setRate] = useState(defaultRate),
    [included, setIncluded] = useState(true),
    [treatment, setTreatment] = useState(defaultTreatment);
  const [direction, setDirection] = useState(row.direction),
    [occurredOn, setOccurredOn] = useState(row.occurred_on);
  const calc = useMemo(() => {
    const result = computeTransactionVat({
      amount,
      rate,
      included,
      treatment,
      direction,
      occurredOn,
      // The server checks registration; the preview only shows the split.
      vatRegistered: true,
    });
    return result.ok ? result : { net: 0, vat: 0, gross: 0, selfAssessed: false };
  }, [amount, rate, included, treatment, direction, occurredOn]);
  const showRate =
    treatment === "domestic" ||
    ((treatment === "eu_b2b_reverse_charge" || treatment === "eu_acquisition") && direction === "expense");
  const posted = row.classification_status === "posted",
    eligible = accounts
      .filter(a =>
        row.direction === "income"
          ? ["revenue", "asset", "liability", "expense"].includes(a.account_type)
          : ["expense", "asset", "liability"].includes(a.account_type),
      )
      .filter(a => !["5131", "421611", "461411"].includes(a.code));
  useEffect(() => {
    if (editState.status === "success" || categoryState.status === "success") {
      dialog.current?.close();
      router.refresh();
    }
  }, [editState.status, categoryState.status, router]);
  useEffect(() => {
    if (deleteState.status === "success") router.refresh();
  }, [deleteState.status, router]);
  return (
    <div
      className={styles.actions}
      onClick={event => event.stopPropagation()}
      onKeyDown={event => event.stopPropagation()}
    >
      <TransactionEvidenceAction
        transactionId={row.id}
        title={row.counterparty_name || row.description || (row.direction === "income" ? "Income" : "Expense")}
        occurredOn={row.occurred_on}
        amountGross={Number(row.amount_gross)}
        currency={row.currency || "EUR"}
        evidence={row.evidence ?? []}
      />
      <TransactionHistoryAction history={row.history ?? []} />
      <button
        type="button"
        className={styles.iconButton}
        onClick={() => dialog.current?.showModal()}
        aria-label="Edit transaction"
      >
        <Pencil size={13} />
      </button>
      <form
        action={deleteAction}
        onSubmit={e => {
          if (
            !window.confirm(
              posted
                ? "Delete this posted transaction? Zuelen will reverse it so the ledger remains auditable."
                : "Delete this transaction?",
            )
          )
            e.preventDefault();
        }}
      >
        <input type="hidden" name="source_transaction_id" value={row.id} />
        <button type="submit" className={`${styles.iconButton} ${styles.danger}`} disabled={deletePending}>
          {deletePending ? <LoaderCircle className={styles.spin} size={13} /> : <Trash2 size={13} />}
        </button>
      </form>
      <dialog ref={dialog} className={styles.dialog}>
        <div className={styles.dialogCard}>
          <div className={styles.dialogHead}>
            <div>
              <span>{posted ? "Accounting-safe correction" : "Edit transaction"}</span>
              <h3>{posted ? "Correct posted transaction" : "Update transaction"}</h3>
            </div>
            <button type="button" onClick={() => dialog.current?.close()}>
              <X size={16} />
            </button>
          </div>
          {posted ? (
            <p className={styles.notice}>
              Posted entries are never rewritten. Saving a change reverses the original entry and posts a corrected one,
              so the ledger keeps both.
            </p>
          ) : null}
          {posted && eligible.length ? (
            <form action={categoryAction}>
              <input type="hidden" name="source_transaction_id" value={row.id} />
              <label className={styles.full}>
                <span>Accounting category</span>
                <select
                  name="account_code"
                  defaultValue={accounts.find(a => a.id === row.suggested_account_id)?.code ?? ""}
                  required
                >
                  <option value="">Choose a category…</option>
                  {eligible.map(a => (
                    <option key={a.id} value={a.code}>
                      {a.code} · {a.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.dialogFooter}>
                <button type="submit" className={styles.secondary} disabled={categoryPending}>
                  {categoryPending ? <LoaderCircle className={styles.spin} size={14} /> : <RefreshCcw size={14} />}{" "}
                  Change category safely
                </button>
              </div>
              {categoryState.status === "error" ? <div className={styles.error}>{categoryState.message}</div> : null}
            </form>
          ) : null}
          <form action={editAction}>
            <input type="hidden" name="source_transaction_id" value={row.id} />
            <div className={styles.grid}>
              <label>
                <span>Type</span>
                <select name="direction" value={direction} onChange={e => setDirection(e.target.value)}>
                  <option value="expense">Expense</option>
                  <option value="income">Income / refund</option>
                </select>
              </label>
              <label>
                <span>Date</span>
                <input
                  name="occurred_on"
                  type="date"
                  value={occurredOn}
                  onChange={e => setOccurredOn(e.target.value)}
                  required
                />
              </label>
              <label className={styles.full}>
                <span>VAT treatment</span>
                <select name="vat_treatment" value={treatment} onChange={e => setTreatment(e.target.value)}>
                  <option value="domestic">Luxembourg VAT</option>
                  <option value="eu_b2b_reverse_charge">
                    {direction === "income"
                      ? "EU business customer · reverse charge"
                      : "EU B2B purchase · reverse charge"}
                  </option>
                  {direction === "expense" || treatment === "eu_acquisition" ? (
                    <option value="eu_acquisition">EU purchase of goods · intra-Community acquisition</option>
                  ) : null}
                  <option value="non_eu">Outside EU / import</option>
                  <option value="exempt_or_zero">No VAT / exempt</option>
                  <option value="outside_scope">Outside the scope of VAT</option>
                  <option value="unknown">Not sure · review later</option>
                </select>
              </label>
              <label>
                <span>Amount</span>
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(Number(e.target.value) || 0)}
                  required
                />
              </label>
              {showRate ? (
                <label>
                  <span>{treatment === "domestic" ? "VAT rate" : "Self-assessed VAT rate"}</span>
                  <select name="vat_rate" value={rate} onChange={e => setRate(Number(e.target.value))}>
                    {vatRatesOn(occurredOn).map(r => (
                      <option value={r} key={r}>
                        {r}%
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <input type="hidden" name="vat_rate" value="0" />
              )}
              {treatment === "domestic" ? (
                <label className={styles.full}>
                  <span>Does the amount include VAT?</span>
                  <select
                    name="vat_included"
                    value={included ? "yes" : "no"}
                    onChange={e => setIncluded(e.target.value === "yes")}
                  >
                    <option value="yes">Yes · TTC / gross</option>
                    <option value="no">No · HT / net</option>
                  </select>
                </label>
              ) : (
                <input type="hidden" name="vat_included" value="no" />
              )}
              <div className={`${styles.notice} ${styles.full}`}>
                <Calculator size={13} /> Net {money(calc.net, row.currency || "EUR")} ·{" "}
                {calc.selfAssessed ? "self-assessed VAT" : "VAT"} {money(calc.vat, row.currency || "EUR")} · Cash{" "}
                {money(calc.gross, row.currency || "EUR")}
              </div>
              <label>
                <span>Customer / supplier</span>
                <input name="counterparty_name" defaultValue={row.counterparty_name ?? ""} />
              </label>
              <label>
                <span>Country</span>
                <input
                  name="counterparty_country"
                  maxLength={2}
                  defaultValue={row.counterparty_country ?? ""}
                  placeholder="LU / FR / US"
                />
              </label>
              <label className={styles.full}>
                <span>Description / reason</span>
                <textarea
                  name="description"
                  defaultValue={row.description ?? ""}
                  placeholder="e.g. Google subscription refund, ACD tax instalment…"
                />
              </label>
            </div>
            {editState.status === "error" ? <div className={styles.error}>{editState.message}</div> : null}
            <div className={styles.dialogFooter}>
              <button type="button" className={styles.secondary} onClick={() => dialog.current?.close()}>
                Cancel
              </button>
              <button type="submit" className={styles.primary} disabled={editPending}>
                {editPending ? <LoaderCircle className={styles.spin} size={14} /> : <Pencil size={14} />}{" "}
                {editPending ? "Saving…" : "Save details"}
              </button>
            </div>
          </form>
        </div>
      </dialog>
      {deleteState.status === "error" ? <span className={styles.inlineError}>{deleteState.message}</span> : null}
    </div>
  );
}
