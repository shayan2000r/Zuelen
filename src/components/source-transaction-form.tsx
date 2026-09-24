"use client";

import { ArrowRight, Camera, CircleHelp, FileUp, LoaderCircle, PenLine, Plus, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createSourceTransaction,
  discardManualSourceTransactionAction,
  postSourceTransaction,
  type TransactionActionState,
  type TransactionReview,
} from "@/app/app/transactions/actions";
import { FloatingActionPortal } from "@/components/floating-action-portal";
import { TransactionUploadReview } from "@/components/transaction-upload-review";
import { UpgradeWall } from "@/components/upgrade-wall";
import styles from "./live.module.css";
import choiceStyles from "./transaction-entry-choice.module.css";

const initialTransactionState:TransactionActionState={status:"idle",message:""};
const rates=[17,14,8,3,0];

function ManualEntryFlow({
  defaultDate,
  locale,
  currency,
  accounts,
  onBack,
  onPrepared,
  onFinish,
  onCancel,
  onBusyChange,
}:{
  defaultDate:string;
  locale:"en"|"fr";
  currency:string;
  accounts:{code:string;label:string;accountType:string}[];
  onBack:()=>void;
  onPrepared:(id:string)=>void;
  onFinish:()=>void;
  onCancel:()=>void;
  onBusyChange:(busy:boolean)=>void;
}){
  const router=useRouter(),fr=locale==="fr";
  const[direction,setDirection]=useState<"expense"|"income">("expense");
  const[busy,setBusy]=useState(false);
  const[message,setMessage]=useState<string|null>(null);
  const[review,setReview]=useState<TransactionReview|null>(null);
  const[selectedAccountCode,setSelectedAccountCode]=useState("");
  const[editingAccount,setEditingAccount]=useState(false);
  const[posted,setPosted]=useState(false);
  const[reviewMessage,setReviewMessage]=useState<string|null>(null);
  const[vatTreatment,setVatTreatment]=useState("unknown");
  const[vatRate,setVatRate]=useState(0);
  const[vatIncluded,setVatIncluded]=useState(true);
  const[transactionCurrency,setTransactionCurrency]=useState(currency.toUpperCase());
  const[exchangeRate,setExchangeRate]=useState("");

  function changeBusy(next:boolean){setBusy(next);onBusyChange(next)}

  async function prepare(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    changeBusy(true);setMessage(null);
    try{
      const formData=new FormData(event.currentTarget);
      const result=await createSourceTransaction(initialTransactionState,formData);
      if(result.status!=="success"||!result.review){
        setMessage(result.message);
        return;
      }
      setReview(result.review);
      setSelectedAccountCode(result.review.suggestedCode??"");
      setEditingAccount(!result.review.suggestedCode);
      setReviewMessage(result.message);
      onPrepared(result.review.id);
      router.refresh();
    }finally{changeBusy(false)}
  }

  async function finalize(){
    if(!review)return;
    if(!selectedAccountCode){
      setEditingAccount(true);
      setReviewMessage(fr?"Choisissez une catégorie comptable avant d’ajouter la transaction.":"Choose an accounting category before adding the transaction.");
      return;
    }
    changeBusy(true);setReviewMessage(null);
    try{
      const formData=new FormData();
      formData.set("source_transaction_id",review.id);
      formData.set("account_code",selectedAccountCode);
      if(review.currency!==review.baseCurrency&&review.exchangeRateToBase)formData.set("exchange_rate_to_base",String(review.exchangeRateToBase));
      const result=await postSourceTransaction(initialTransactionState,formData);
      if(result.status!=="success"){
        setReviewMessage(result.message);
        return;
      }
      setPosted(true);
      setReviewMessage(fr?"Ajoutée aux Transactions et comptabilisée.":"Added to Transactions and posted to the ledger.");
      router.refresh();
      window.setTimeout(onFinish,750);
    }finally{changeBusy(false)}
  }

  if(review){
    return <TransactionUploadReview
      review={review}
      selectedAccountCode={selectedAccountCode}
      editingAccount={editingAccount}
      busy={busy}
      posted={posted}
      message={reviewMessage}
      onSelectAccount={setSelectedAccountCode}
      onToggleAccount={()=>{
        if(editingAccount&&review.suggestedCode)setSelectedAccountCode(review.suggestedCode);
        setEditingAccount(current=>!current);
      }}
      onConfirm={finalize}
      onReviewLater={onCancel}
      source="manual"
      locale={locale}
    />;
  }

  const counterpartyLabel=direction==="expense"?(fr?"Payé à":"Paid to"):(fr?"Reçu de":"Received from");
  const amountLabel=direction==="expense"?(fr?"Total payé":"Total paid"):(fr?"Total reçu":"Total received");
  const foreignCurrency=transactionCurrency.toUpperCase()!==currency.toUpperCase();
  const categoryOptions=accounts.filter(account=>direction==="income"?["revenue","asset","liability","expense"].includes(account.accountType):["expense","asset","liability"].includes(account.accountType));

  return <>
    <button type="button" className={choiceStyles.back} onClick={onBack} disabled={busy}>{fr?"← Retour":"← Back"}</button>
    <p className={styles.eyebrow}>{fr?"Saisie manuelle · Étape 1 sur 2":"Manual entry · Step 1 of 2"}</p>
    <h2 id="new-transaction-title">{fr?"Que s’est-il passé ?":"What happened?"}</h2>
    <p>{fr?"Saisissez simplement ce que vous savez. Zuelen vous proposera la catégorie comptable à l’étape suivante. Les détails TVA sont facultatifs.":"Enter what you actually know. Zuelen will suggest the accounting category next. VAT details are optional."}</p>

    <form onSubmit={prepare} className={styles.transactionForm}>
      <div className={styles.fieldFull}>
        <span className={styles.fieldLabel}>{fr?"Type":"Type"}</span>
        <div className={styles.typeToggle} role="group" aria-label={fr?"Type de transaction":"Transaction type"}>
          <button type="button" className={direction==="expense"?styles.typeActive:""} onClick={()=>setDirection("expense")}>{fr?"Dépense":"Expense"}</button>
          <button type="button" className={direction==="income"?styles.typeActive:""} onClick={()=>setDirection("income")}>{fr?"Revenu / remboursement":"Income / refund"}</button>
        </div>
        <input type="hidden" name="direction" value={direction}/>
      </div>

      <label className={styles.field}><span>{fr?"Date":"Date"}</span><input name="occurred_on" type="date" defaultValue={defaultDate} required/></label>
      <label className={styles.field}><span>{amountLabel+" · "+transactionCurrency}</span><input name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0.00" required/></label>
      <label className={styles.field}><span>{fr?"Devise":"Currency"}</span><input name="currency" value={transactionCurrency} onChange={event=>setTransactionCurrency(event.target.value.toUpperCase().replace(/[^A-Z]/g,"").slice(0,3))} list="transaction-currencies" maxLength={3} pattern="[A-Z]{3}" required/><datalist id="transaction-currencies"><option value={currency.toUpperCase()}/><option value="EUR"/><option value="USD"/><option value="GBP"/><option value="CHF"/></datalist></label>
      {foreignCurrency?<label className={styles.field}><span>{fr?`Taux de change · 1 ${transactionCurrency} en ${currency.toUpperCase()}`:`Exchange rate · 1 ${transactionCurrency} in ${currency.toUpperCase()}`}</span><input name="exchange_rate_to_base" type="number" min="0.00000001" step="0.00000001" inputMode="decimal" value={exchangeRate} onChange={event=>setExchangeRate(event.target.value)} placeholder="0.00000000" required/><small className={styles.fieldHelp}>{fr?"Utilisez le taux figurant sur votre paiement ou relevé. Zuelen ne suppose jamais un taux 1:1.":"Use the rate shown on your payment or bank record. Zuelen never assumes a 1:1 exchange rate."}</small></label>:<input type="hidden" name="exchange_rate_to_base" value="1"/>}

      <label className={styles.field}><span>{counterpartyLabel}</span><input name="counterparty_name" placeholder={direction==="expense"?(fr?"ex. McDonald's, Lidl, Adobe":"e.g. McDonald's, Lidl, Adobe"):(fr?"ex. Acme SARL, Upwork":"e.g. Acme SARL, Upwork")}/></label>
      <label className={styles.field}><span>{fr?"À quoi cela correspond ?":"What was it for?"}</span><input name="description" placeholder={direction==="expense"?(fr?"ex. repas d’équipe, logiciel, fournitures":"e.g. team lunch, software, office supplies"):(fr?"ex. paiement client, remboursement":"e.g. client payment, refund")}/></label>

      <label className={styles.field+" "+styles.fieldFull}><span>{fr?"Catégorie comptable · facultatif":"Accounting category · optional"}</span><select name="account_code" defaultValue=""><option value="">{fr?"Laisser Zuelen proposer une catégorie":"Let Zuelen suggest a category"}</option>{categoryOptions.map(account=><option key={account.code} value={account.code}>{account.code+" · "+account.label}</option>)}</select><small className={styles.fieldHelp}>{fr?"Si vous connaissez déjà la catégorie, choisissez-la maintenant. Vous pourrez encore la modifier à l’étape suivante.":"If you already know the category, choose it now. You can still change it on the next step."}</small></label>

      <details className={styles.vatDetails+" "+styles.fieldFull}>
        <summary>
          <span><CircleHelp size={15}/><strong>{fr?"Détails TVA":"VAT details"}</strong><em>{fr?"Facultatif · laissez vide si vous ne savez pas":"Optional · skip if you don't know"}</em></span>
        </summary>
        <div className={styles.vatDetailsBody}>
          <p>{direction==="expense"
            ?(fr?"Si vous ne connaissez que le montant payé, gardez « Je ne sais pas ». Zuelen n’inventera pas de TVA et n’en récupérera aucune sans détail ou justificatif.":"If you only know what you paid, keep “Not sure”. Zuelen will not invent VAT or claim any without VAT details or evidence.")
            :(fr?"Si ce revenu correspond à une facture émise, utilisez de préférence le flux Factures. Sinon, ajoutez les détails TVA uniquement si vous les connaissez.":"If this income relates to an issued invoice, use the Invoices flow when possible. Otherwise add VAT details only if you know them.")}</p>
          <label className={styles.field}><span>{fr?"Situation TVA":"VAT situation"}</span>
            <select name="vat_treatment" value={vatTreatment} onChange={e=>setVatTreatment(e.target.value)}>
              <option value="unknown">{fr?"Je ne sais pas":"Not sure"}</option>
              <option value="domestic">{fr?"TVA luxembourgeoise":"Luxembourg VAT"}</option>
              <option value="exempt_or_zero">{fr?"Pas de TVA / exonéré":"No VAT / exempt"}</option>
              <option value="eu_b2b_reverse_charge">{fr?"Achat B2B UE · autoliquidation":"EU B2B purchase · reverse charge"}</option>
              <option value="non_eu">{fr?"Hors UE / importation":"Outside EU / import"}</option>
            </select>
          </label>
          {(vatTreatment==="domestic"||vatTreatment==="eu_b2b_reverse_charge")?<label className={styles.field}><span>{fr?"Taux TVA si connu":"VAT rate if known"}</span><select name="vat_rate" value={vatRate} onChange={e=>setVatRate(Number(e.target.value))}>{rates.map(rate=><option value={rate} key={rate}>{rate===0?(fr?"Je ne sais pas":"Not sure"):rate+"%"}</option>)}</select></label>:<input type="hidden" name="vat_rate" value="0"/>}
          {vatTreatment==="domestic"?<label className={styles.field}><span>{fr?"Le montant saisi est":"The amount entered is"}</span><select name="vat_included" value={vatIncluded?"yes":"no"} onChange={e=>setVatIncluded(e.target.value==="yes")}><option value="yes">{fr?"Le total payé/reçu (TTC)":"The total paid/received (incl. VAT)"}</option><option value="no">{fr?"Le montant hors TVA (HT)":"The amount before VAT"}</option></select></label>:<input type="hidden" name="vat_included" value="no"/>}
          <label className={styles.field}><span>{fr?"Pays du tiers · facultatif":"Counterparty country · optional"}</span><input name="counterparty_country" maxLength={2} placeholder="LU / FR / US" style={{textTransform:"uppercase"}}/></label>
        </div>
      </details>

      {message?<div className={styles.formMessage+" "+styles.fieldFull+" "+styles.formError}>{message}</div>:null}
      <button className={styles.submitButton} type="submit" disabled={busy}>{busy?<LoaderCircle className={styles.reviewSpinner} size={15}/>:<ArrowRight size={15}/>}<span>{busy?(fr?"Préparation…":"Preparing…"):(fr?"Continuer vers la catégorie":"Continue to category")}</span></button>
    </form>
  </>;
}

export function SourceTransactionForm({defaultDate,initialOpen=false,locale="en",currency="EUR",accounts=[]}:{defaultDate?:string;initialOpen?:boolean;locale?:"en"|"fr";currency?:string;accounts?:{code:string;label:string;accountType:string}[]}){
  const fr=locale==="fr",today=defaultDate||new Date().toISOString().slice(0,10);
  const[open,setOpen]=useState(initialOpen),[entryMode,setEntryMode]=useState<"choose"|"manual">("choose"),[upgradeOpen,setUpgradeOpen]=useState(false),[draftId,setDraftId]=useState<string|null>(null),[closing,setClosing]=useState(false),[flowBusy,setFlowBusy]=useState(false);

  const finish=useCallback(()=>{setDraftId(null);setOpen(false);setEntryMode("choose");setFlowBusy(false)},[]);
  const close=useCallback(async()=>{
    if(flowBusy||closing)return;
    setClosing(true);
    try{
      if(draftId)await discardManualSourceTransactionAction(draftId);
      setDraftId(null);setOpen(false);setEntryMode("choose");
    }finally{setClosing(false)}
  },[closing,draftId,flowBusy]);

  useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")void close()};window.addEventListener("keydown",onKey);return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",onKey)}},[open,close]);

  return <>
    <FloatingActionPortal><button className={styles.fab} type="button" onClick={()=>{setEntryMode("choose");setOpen(true)}}><Plus size={17}/>{fr?"Ajouter":"Add"}</button></FloatingActionPortal>
    {open?<div className={styles.drawerOverlay} role="presentation" onMouseDown={event=>{if(event.currentTarget===event.target)void close()}}>
      <div className={styles.drawerShell}>
        <button autoFocus className={styles.drawerClose} type="button" onClick={()=>void close()} disabled={closing||flowBusy} aria-label={fr?"Fermer":"Close"}>{closing?<LoaderCircle className={styles.reviewSpinner} size={17}/>:<X size={18}/>}</button>
        <aside className={styles.formPanel+" "+styles.drawerCard} role="dialog" aria-modal="true" aria-labelledby="new-transaction-title">
          {entryMode==="choose"?<>
            <p className={styles.eyebrow}>{fr?"Nouvelle activité":"New activity"}</p>
            <h2 id="new-transaction-title">{fr?"Ajouter une transaction":"Add a transaction"}</h2>
            <p>{fr?"Choisissez la méthode la plus rapide. Vous vérifierez la catégorie avant toute comptabilisation.":"Choose the fastest way to start. You'll confirm the accounting category before anything is posted."}</p>
            <div className={choiceStyles.choices}>
              <Link href="/app/documents?create=upload&purpose=transaction"><span><FileUp size={20}/></span><div><strong>{fr?"Importer un document":"Upload document"}</strong><small>{fr?"Ajoutez une facture ou un reçu et laissez Zuelen extraire les informations visibles.":"Add an invoice or receipt and let Zuelen extract the visible details."}</small></div></Link>
              <Link href="/app/documents?create=scan&purpose=transaction"><span><Camera size={20}/></span><div><strong>{fr?"Scanner":"Scan"}</strong><small>{fr?"Photographiez directement un reçu ou une facture depuis votre mobile.":"Photograph a receipt or invoice directly from your phone."}</small></div></Link>
              <button type="button" onClick={()=>setEntryMode("manual")}><span><PenLine size={20}/></span><div><strong>{fr?"Saisie manuelle":"Manual"}</strong><small>{fr?"Saisissez simplement la date, le montant et ce qui s’est passé. La TVA peut rester inconnue.":"Enter the date, total amount and what happened. You don't need to know the VAT."}</small></div></button>
            </div>
          </>:<ManualEntryFlow
            defaultDate={today}
            locale={locale}
            currency={currency}
            accounts={accounts}
            onBack={()=>{if(!flowBusy&&!draftId)setEntryMode("choose")}}
            onPrepared={setDraftId}
            onFinish={finish}
            onCancel={()=>void close()}
            onBusyChange={setFlowBusy}
          />}
        </aside>
      </div>
    </div>:null}
    <UpgradeWall open={upgradeOpen} message="" onClose={()=>setUpgradeOpen(false)}/>
  </>;
}
