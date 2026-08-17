"use client";

import { ArrowDownToLine, CheckCircle2, Landmark, LoaderCircle, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { recordInvoicePaymentAction, type PaymentActionState } from "@/app/app/invoices/payment-actions";
import styles from "./invoice-payment.module.css";

type BankCandidate = { id: string; booking_date: string; amount: number | string; counterparty_name: string | null; reference: string | null };
type Payment = { id: string; paid_on: string; amount: number | string; reference: string | null; bank_transaction_id: string | null };

const initialState: PaymentActionState = { status: "idle", message: "" };

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-LU", { style: "currency", currency, minimumFractionDigits: 2 }).format(value);
}

export function InvoicePaymentPanel({ invoiceId, total, paid, currency, paymentStatus, candidates, payments }: {
  invoiceId: string;
  total: number;
  paid: number;
  currency: string;
  paymentStatus: string;
  candidates: BankCandidate[];
  payments: Payment[];
}) {
  const router = useRouter();
  const outstanding = Math.max(0, total - paid);
  const [state, formAction, pending] = useActionState(recordInvoicePaymentAction, initialState);
  const [source, setSource] = useState("manual");
  const [amount, setAmount] = useState(outstanding.toFixed(2));
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));

  const selected = useMemo(() => candidates.find((candidate) => candidate.id === source), [candidates, source]);
  useEffect(() => {
    if (selected) {
      setAmount(Number(selected.amount).toFixed(2));
      setPaidOn(selected.booking_date);
    } else {
      setAmount(outstanding.toFixed(2));
    }
  }, [selected, outstanding]);
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [router, state.status]);

  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  return (
    <section className={styles.shell} id="payment">
      <div className={styles.summary}>
        <div className={styles.kicker}><WalletCards size={14} />Receivable</div>
        <div className={styles.amount}>{money(outstanding, currency)}</div>
        <p>{paymentStatus === "paid" ? "This invoice is fully settled." : "Outstanding customer balance."}</p>
        <div className={styles.progress}><span style={{ width: `${pct}%` }} /></div>
        <div className={styles.stats}><div><span>Invoice</span><strong>{money(total, currency)}</strong></div><div><span>Paid</span><strong>{money(paid, currency)}</strong></div><div><span>Outstanding</span><strong>{money(outstanding, currency)}</strong></div></div>
      </div>

      {paymentStatus !== "paid" ? (
        <form action={formAction} className={styles.form}>
          <div className={styles.formHead}><div><span>Record settlement</span><h3>Match or record a payment.</h3></div><Landmark size={19} /></div>
          <input type="hidden" name="invoice_id" value={invoiceId} />
          <label><span>Payment source</span><select value={source} onChange={(event) => setSource(event.target.value)}><option value="manual">Manual payment record</option>{candidates.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.booking_date} · {money(Number(candidate.amount), currency)} · {candidate.counterparty_name || candidate.reference || "Bank transaction"}</option>)}</select></label>
          <input type="hidden" name="bank_transaction_id" value={source === "manual" ? "" : source} />
          <div className={styles.grid}><label><span>Amount</span><input name="amount" type="number" min="0.01" max={outstanding.toFixed(2)} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label><label><span>Payment date</span><input name="paid_on" type="date" value={paidOn} onChange={(event) => setPaidOn(event.target.value)} required /></label></div>
          <label><span>Reference</span><input name="reference" placeholder="Optional bank or payment reference" /></label>
          {selected ? <div className={styles.matchNote}><ArrowDownToLine size={14} /><span>This bank movement will be marked matched. Revenue will not be booked again.</span></div> : null}
          {state.message ? <div className={`${styles.message} ${state.status === "error" ? styles.error : ""}`}>{state.status === "success" ? <CheckCircle2 size={14} /> : null}{state.message}</div> : null}
          <button type="submit" disabled={pending}>{pending ? <LoaderCircle className={styles.spin} size={15} /> : <CheckCircle2 size={15} />}{pending ? "Posting payment…" : selected ? "Match payment & post" : "Record payment & post"}</button>
        </form>
      ) : <div className={styles.settled}><CheckCircle2 size={22} /><div><strong>Paid in full</strong><span>The receivable has been cleared from account 4011.</span></div></div>}

      {payments.length > 0 ? <div className={styles.history}><div className={styles.historyHead}><span>Payment history</span><strong>{payments.length}</strong></div>{payments.map((payment) => <div className={styles.historyRow} key={payment.id}><div><strong>{new Date(`${payment.paid_on}T12:00:00`).toLocaleDateString("en-LU", { day: "2-digit", month: "short", year: "numeric" })}</strong><span>{payment.bank_transaction_id ? "Matched bank transaction" : payment.reference || "Manual payment record"}</span></div><b>{money(Number(payment.amount), currency)}</b></div>)}</div> : null}
    </section>
  );
}
