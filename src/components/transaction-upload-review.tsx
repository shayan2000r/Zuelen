"use client";

import { CheckCircle2, LoaderCircle, Sparkles } from "lucide-react";
import type { TransactionReview } from "@/app/app/transactions/actions";
import styles from "./documents.module.css";

function money(value:number,currency:string){
  return new Intl.NumberFormat("en-LU",{style:"currency",currency,minimumFractionDigits:2}).format(value);
}

export function TransactionUploadReview({
  review,
  selectedAccountCode,
  editingAccount,
  busy,
  posted,
  message,
  onSelectAccount,
  onToggleAccount,
  onConfirm,
  onReviewLater,
}:{
  review:TransactionReview;
  selectedAccountCode:string;
  editingAccount:boolean;
  busy:boolean;
  posted:boolean;
  message:string|null;
  onSelectAccount:(code:string)=>void;
  onToggleAccount:()=>void;
  onConfirm:()=>void;
  onReviewLater:()=>void;
}){
  return <>
    <div className={styles.uploadHead}>
      <div>
        <p>AI-assisted bookkeeping</p>
        <h2>{posted?"Transaction added":"Ready to add"}</h2>
      </div>
      <span><Sparkles size={14}/>{posted?"Done":"AI review"}</span>
    </div>
    <p className={styles.uploadLead}>
      {posted
        ?"The transaction is posted and the source document remains linked as evidence."
        :"Zuelen read the document and prepared the transaction. Confirm the suggested accounting category or change it before posting."}
    </p>

    <div className={styles.transactionReviewCard}>
      <div className={styles.transactionFacts}>
        <div><span>Counterparty</span><strong>{review.counterpartyName}</strong></div>
        <div><span>Date</span><strong>{review.occurredOn}</strong></div>
        <div><span>Amount</span><strong>{money(review.amountGross,review.currency)}</strong></div>
      </div>

      {posted?
        <div className={styles.transactionPosted}>
          <CheckCircle2 size={19}/>
          <div>
            <strong>Added to Transactions</strong>
            <span>{message??"Posted successfully with the receipt linked as evidence."}</span>
          </div>
        </div>
      :<>
        <div className={styles.suggestionCard}>
          <div className={styles.suggestionTop}>
            <span className={styles.suggestionIcon}><Sparkles size={16}/></span>
            <div>
              <small>Zuelen suggestion</small>
              <strong>{review.suggestedLabel??"Choose an accounting category"}</strong>
              {review.suggestedCode?
                <span>PCN {review.suggestedCode}{review.suggestionConfidence!=null?` · ${Math.round(review.suggestionConfidence*100)}% confidence`:""}</span>
              :<span>No confident category yet</span>}
            </div>
          </div>
          {review.suggestionReason?<p>{review.suggestionReason}</p>:null}
        </div>

        {editingAccount||!review.suggestedCode?
          <label className={styles.accountPicker}>
            <span>Accounting category</span>
            <select value={selectedAccountCode} onChange={event=>onSelectAccount(event.target.value)}>
              <option value="">Choose a PCN account</option>
              {review.accounts.map(account=><option key={account.code} value={account.code}>{account.code} · {account.label}</option>)}
            </select>
          </label>
        :null}

        {message?<div className={styles.transactionHint}>{message}</div>:null}

        <div className={styles.transactionReviewActions}>
          <button type="button" className={styles.transactionPrimary} onClick={onConfirm} disabled={busy||!selectedAccountCode}>
            {busy?<LoaderCircle className={styles.spin} size={15}/>:<CheckCircle2 size={15}/>}
            Add to transactions
          </button>
          <button type="button" className={styles.transactionSecondary} onClick={onToggleAccount} disabled={busy}>
            {editingAccount?"Use suggestion":"Change category"}
          </button>
          <button type="button" className={styles.transactionTertiary} onClick={onReviewLater} disabled={busy}>
            Review later
          </button>
        </div>
        <small className={styles.transactionFootnote}>Adding the transaction posts it to the ledger. The uploaded receipt remains linked as source evidence.</small>
      </>}
    </div>
  </>;
}
