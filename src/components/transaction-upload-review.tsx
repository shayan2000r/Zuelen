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
  source="document",
  locale="en",
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
  source?:"document"|"manual";
  locale?:"en"|"fr";
}){
  const fr=locale==="fr",manual=source==="manual";
  const title=posted
    ?(fr?"Transaction ajoutée":"Transaction added")
    :(fr?"Prête à ajouter":"Ready to add");
  const lead=posted
    ?(manual
      ?(fr?"La transaction a été comptabilisée avec la catégorie confirmée.":"The transaction has been posted with the category you confirmed.")
      :(fr?"La transaction est comptabilisée et le document source reste lié comme justificatif.":"The transaction is posted and the source document remains linked as evidence."))
    :(manual
      ?(fr?"Zuelen a préparé la transaction à partir des informations saisies. Confirmez la catégorie comptable ou modifiez-la avant la comptabilisation.":"Zuelen prepared the transaction from the details you entered. Confirm the suggested accounting category or change it before posting.")
      :(fr?"Zuelen a lu le document et préparé la transaction. Confirmez la catégorie comptable suggérée ou modifiez-la avant la comptabilisation.":"Zuelen read the document and prepared the transaction. Confirm the suggested accounting category or change it before posting."));

  return <>
    <div className={styles.uploadHead}>
      <div>
        <p>{manual?(fr?"Saisie manuelle · Étape 2 sur 2":"Manual entry · Step 2 of 2"):(fr?"Comptabilité assistée par IA":"AI-assisted bookkeeping")}</p>
        <h2>{title}</h2>
      </div>
      <span><Sparkles size={14}/>{posted?(fr?"Terminé":"Done"):(fr?"Suggestion Zuelen":"Zuelen review")}</span>
    </div>
    <p className={styles.uploadLead}>{lead}</p>

    <div className={styles.transactionReviewCard}>
      <div className={styles.transactionFacts}>
        <div><span>{fr?"Tiers":"Counterparty"}</span><strong>{review.counterpartyName}</strong></div>
        <div><span>{fr?"Date":"Date"}</span><strong>{review.occurredOn}</strong></div>
        <div><span>{fr?"Montant":"Amount"}</span><strong>{money(review.amountGross,review.currency)}</strong></div>
      </div>

      {posted?
        <div className={styles.transactionPosted}>
          <CheckCircle2 size={19}/>
          <div>
            <strong>{fr?"Ajoutée aux transactions":"Added to Transactions"}</strong>
            <span>{message??(manual
              ?(fr?"La transaction a été comptabilisée avec succès.":"Posted successfully.")
              :(fr?"Comptabilisée avec le justificatif lié.":"Posted successfully with the receipt linked as evidence."))}</span>
          </div>
        </div>
      :<>
        <div className={styles.suggestionCard}>
          <div className={styles.suggestionTop}>
            <span className={styles.suggestionIcon}><Sparkles size={16}/></span>
            <div>
              <small>{fr?"Suggestion Zuelen":"Zuelen suggestion"}</small>
              <strong>{review.suggestedLabel??(fr?"Choisissez une catégorie comptable":"Choose an accounting category")}</strong>
              {review.suggestedCode?
                <span>{"PCN "+review.suggestedCode+(review.suggestionConfidence!=null?" · "+Math.round(review.suggestionConfidence*100)+"% "+(fr?"de confiance":"confidence"):"")}</span>
              :<span>{fr?"Aucune catégorie suffisamment fiable pour le moment":"No confident category yet"}</span>}
            </div>
          </div>
          {review.suggestionReason?<p>{review.suggestionReason}</p>:null}
        </div>

        {editingAccount||!review.suggestedCode?
          <label className={styles.accountPicker}>
            <span>{fr?"Catégorie comptable":"Accounting category"}</span>
            <select value={selectedAccountCode} onChange={event=>onSelectAccount(event.target.value)}>
              <option value="">{fr?"Choisir un compte PCN":"Choose a PCN account"}</option>
              {review.accounts.map(account=><option key={account.code} value={account.code}>{account.code+" · "+account.label}</option>)}
            </select>
          </label>
        :null}

        {message?<div className={styles.transactionHint}>{message}</div>:null}

        <div className={styles.transactionReviewActions}>
          <button type="button" className={styles.transactionPrimary} onClick={onConfirm} disabled={busy||!selectedAccountCode}>
            {busy?<LoaderCircle className={styles.spin} size={15}/>:<CheckCircle2 size={15}/>}
            {fr?"Ajouter la transaction":"Add transaction"}
          </button>
          <button type="button" className={styles.transactionSecondary} onClick={onToggleAccount} disabled={busy}>
            {editingAccount?(fr?"Utiliser la suggestion":"Use suggestion"):(fr?"Changer la catégorie":"Change category")}
          </button>
          <button type="button" className={styles.transactionTertiary} onClick={onReviewLater} disabled={busy}>
            {manual?(fr?"Annuler":"Cancel"):(fr?"Vérifier plus tard":"Review later")}
          </button>
        </div>
        <small className={styles.transactionFootnote}>
          {manual
            ?(fr?"Zuelen ne devine jamais la TVA d’une saisie manuelle. Si vous avez laissé les détails TVA vides, le montant total est comptabilisé sans TVA récupérée ou calculée.":"Zuelen never guesses VAT from a manual entry. If you left VAT details blank, the full amount is recorded without claiming or calculating VAT.")
            :(fr?"L’ajout comptabilise la transaction. Le reçu importé reste lié comme justificatif.":"Adding the transaction posts it to the ledger. The uploaded receipt remains linked as source evidence.")}
        </small>
      </>}
    </div>
  </>;
}
