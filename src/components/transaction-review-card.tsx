"use client";

import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Landmark, LoaderCircle, LockKeyhole, Search, Sparkles, X } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { type TransactionActionState } from "@/app/app/transactions/actions";
import { postSmartSourceTransaction } from "@/app/app/transactions/smart-actions";
import styles from "./transaction-review-card.module.css";

type Account={id:string;code:string;label:string;account_type:string};
type PcnAccount={id:string;code:string;label:string;account_type:string;account_class:number|null;parent_code:string|null};
type Transaction={id:string;occurred_on:string;direction:string;amount_gross:number|string;amount_net:number|string|null;vat_amount:number|string|null;currency:string;counterparty_name:string|null;description:string|null;suggested_account_id?:string|null;suggestion_confidence?:number|string|null;suggestion_reason?:string|null;suggestion_kind?:string|null;display_name?:string|null;bank_evidence?:string|null};
const initialTransactionState:TransactionActionState={status:"idle",message:""};
function money(value:number,currency:string){return new Intl.NumberFormat("en-LU",{style:"currency",currency,minimumFractionDigits:2}).format(value)}
function normalize(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
function aliases(account:PcnAccount){
  const code=account.code,terms:string[]=[];
  if(code==="6132")terms.push("software saas cloud hosting website web wix hostinger chatgpt openai it informatique logiciel abonnement subscription digital service");
  if(code.startsWith("6151"))terms.push("marketing advertising ads facebook meta google ads campaign publicity publicite promotion social media");
  if(code==="61333"||code==="61338")terms.push("bank fee bank charge banking commission post finance frais bancaire frais compte commission");
  if(code==="61334")terms.push("stripe payment processing card payment merchant fee electronic payment frais paiement electronique commission carte");
  if(code==="61532")terms.push("phone mobile internet telecom telephone telecommunications");
  if(code==="61348"||code==="6138")terms.push("professional fee consultant freelancer contractor honoraires consulting service provider upwork escrow refund remboursement");
  if(code==="6413")terms.push("software licence license subscription app saas");
  if(code==="4712")terms.push("shareholder current account owner loan shareholder contribution money put into company apport compte courant associe company owes shareholder remboursement associe paid shareholder back");
  if(code==="4212")terms.push("shareholder owes company receivable from shareholder creance associe avance personnelle owner owes company");
  if(code==="42148")terms.push("acd quarterly tax advance tax prepayment administration contributions directes avance fiscale acompte fiscal impots");
  if(code==="42141")terms.push("corporate income tax irc advance acompte impôt revenu collectivites");
  if(code==="42142")terms.push("municipal business tax icc advance impot commercial communal");
  if(code==="42143")terms.push("net wealth tax if advance impot fortune");
  if(code.startsWith("703"))terms.push("client payment service revenue sales invoice upwork freelance web design development customer income chiffre affaires prestation youtube adsense google creator platform payout monetization");
  if(code.startsWith("611"))terms.push("rent rental lease office coworking loyer location");
  if(code.startsWith("612"))terms.push("maintenance repair entretien reparation");
  if(code.startsWith("614"))terms.push("insurance assurance");
  if(code.startsWith("616"))terms.push("travel transport hotel restaurant meal deplacement voyage");
  return terms.join(" ");
}
function groupLabel(account:PcnAccount,fr:boolean){if(account.account_type==="expense")return fr?"Charges":"Expenses";if(account.account_type==="revenue")return fr?"Produits":"Revenue";if(account.account_type==="asset")return fr?"Actifs":"Assets";if(account.account_type==="liability")return fr?"Passifs":"Liabilities";if(account.account_type==="equity")return fr?"Capitaux propres":"Equity";return fr?"Autres":"Other"}
function scoreAccount(account:PcnAccount,query:string,context:string){const q=normalize(query),tokens=q.split(" ").filter(Boolean),label=normalize(`${account.code} ${account.label} ${aliases(account)}`),contextNorm=normalize(context);let score=0;if(!q)return 0;if(account.code===q)score+=180;else if(account.code.startsWith(q))score+=120;if(label.includes(q))score+=80;for(const token of tokens){if(label.includes(token))score+=28;if(contextNorm.includes(token)&&label.includes(token))score+=8}if(tokens.length&&tokens.every(token=>label.includes(token)))score+=35;return score}
function guidanceTitle(kind:string|null|undefined,account:PcnAccount|undefined,fr:boolean){const value=(kind??"").toLowerCase();if(value.includes("shareholder"))return fr?"Compte courant d’associé":"Shareholder current account";if(value.includes("tax_advance"))return fr?"Avance fiscale trimestrielle ACD":"Quarterly ACD tax advance";if(value.includes("tax_payment"))return fr?"Paiement fiscal ACD":"ACD tax payment";if(value.includes("payment_processor"))return fr?"Frais de traitement des paiements":"Payment processing fee";if(value.includes("refund"))return fr?"Remboursement possible — retrouver l’achat d’origine":"Possible refund — match the original purchase";return account?.label??(fr?"Vérification nécessaire":"Needs review")}

export function TransactionReviewCard({transaction,accounts,pcnAccounts,locale="en"}:{transaction:Transaction;accounts:Account[];pcnAccounts:PcnAccount[];locale?:"en"|"fr"}){
  const fr=locale==="fr",income=transaction.direction==="income";
  const suggestedCompany=accounts.find(account=>account.id===transaction.suggested_account_id);
  const suggested=pcnAccounts.find(account=>account.code===suggestedCompany?.code);
  const[accountCode,setAccountCode]=useState("");
  const[purpose,setPurpose]=useState("");
  const[resultsOpen,setResultsOpen]=useState(false);
  const[state,formAction,pending]=useActionState(postSmartSourceTransaction,initialTransactionState);
  useEffect(()=>{setAccountCode("");setPurpose("");setResultsOpen(false)},[transaction.id]);
  const eligible=useMemo(()=>pcnAccounts.filter(account=>{if(["5131","421611","461411"].includes(account.code))return false;return income?["revenue","asset","liability","expense"].includes(account.account_type):["expense","asset","liability"].includes(account.account_type)}),[pcnAccounts,income]);
  const selected=eligible.find(account=>account.code===accountCode);
  const context=`${transaction.display_name??""} ${transaction.counterparty_name??""} ${transaction.description??""} ${transaction.bank_evidence??""}`;
  const results=useMemo(()=>{if(normalize(purpose).length<2)return[];return eligible.map(account=>({account,score:scoreAccount(account,purpose,context)})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.account.code.localeCompare(b.account.code)).slice(0,8).map(item=>item.account)},[eligible,purpose,context]);
  const gross=Number(transaction.amount_gross),vat=Number(transaction.vat_amount??0),net=Number(transaction.amount_net??gross-vat),isExpenseRefund=income&&selected?.account_type==="expense";
  const title=transaction.display_name||transaction.counterparty_name||transaction.description||(transaction.suggestion_kind==="refund_candidate"?(fr?"Remboursement fournisseur possible":"Possible supplier refund"):income?(fr?"Encaissement":"Income transaction"):(fr?"Décaissement":"Expense transaction"));
  const confidence=transaction.suggestion_confidence==null?null:Math.round(Number(transaction.suggestion_confidence)*100);
  const hasGuidance=Boolean(suggested||transaction.suggestion_reason);
  const placeholder=income?(fr?"Ex. revenu YouTube, paiement client, apport d’associé…":"e.g. YouTube revenue, client payment, shareholder put money in…"):(fr?"Ex. avance fiscale ACD, frais Stripe, logiciel, remboursement d’associé…":"e.g. quarterly ACD tax advance, Stripe fee, software, company paid shareholder back…");
  return <article className={styles.card}>
    <div className={styles.top}><div><p className={styles.eyebrow}>{fr?"À vérifier maintenant":"Next to review"}</p><h2>{title}</h2><div className={styles.sub}><span>{new Date(`${transaction.occurred_on}T12:00:00`).toLocaleDateString(fr?"fr-LU":"en-LU",{day:"2-digit",month:"long",year:"numeric"})}</span>{transaction.description&&transaction.description!==title?<span>· {transaction.description}</span>:null}</div></div></div>
    <div className={`${styles.movement} ${income?styles.movementIn:styles.movementOut}`}>
      <span className={styles.movementIcon}>{income?<ArrowUpRight size={19}/>:<ArrowDownLeft size={19}/>}</span>
      <div className={styles.movementCopy}><strong>{income?(fr?"Argent entrant":"Money in"):(fr?"Argent sortant":"Money out")}</strong><span>{income?(fr?"Crédité sur votre compte bancaire — le solde bancaire augmente.":"Credited to your bank account — the bank balance increased."):(fr?"Débité de votre compte bancaire — le solde bancaire diminue.":"Debited from your bank account — the bank balance decreased.")}</span></div>
      <b className={styles.movementAmount}>{income?"+":"−"}{money(gross,transaction.currency)}</b>
    </div>
    {hasGuidance?<div className={styles.suggestion}><Sparkles size={15}/><div><strong>{fr?"Suggestion Zuelen":"Zuelen suggestion"}: {guidanceTitle(transaction.suggestion_kind,suggested,fr)}</strong><p>{suggested?`${suggested.label} · ${groupLabel(suggested,fr)} · PCN ${suggested.code}${confidence!==null?` · ${confidence}%`:""}`:confidence!==null?`${confidence}%`:null}{transaction.suggestion_reason?`${suggested||confidence!==null?" · ":""}${transaction.suggestion_reason}`:""}</p></div>{suggested?<button type="button" className={styles.useSuggestion} onClick={()=>{setAccountCode(suggested.code);setPurpose("");setResultsOpen(false)}}>{fr?"Utiliser":"Use"}</button>:null}</div>:null}
    <div className={styles.meta}><div><span>Net</span><strong>{money(net,transaction.currency)}</strong></div><div><span>VAT</span><strong>{money(vat,transaction.currency)}</strong></div><div><span>{fr?"Règlement":"Settlement"}</span><strong>Bank · 5131</strong></div></div>
    <form action={formAction} className={styles.form}><input type="hidden" name="source_transaction_id" value={transaction.id}/><input type="hidden" name="account_code" value={accountCode}/>
      <div className={styles.question}><strong>{fr?"À quoi correspondait cette transaction ?":"What was this transaction for?"}</strong><span>{fr?"Décrivez simplement ce qui s’est passé pour votre entreprise. Vous n’avez pas besoin de connaître un compte PCN.":"Describe what happened in normal business language. You do not need to know an accounting or PCN code."}</span></div>
      <div className={styles.searchWrap}><Search size={16} style={{position:"absolute",left:14,top:16,color:"var(--z-text-secondary)"}}/><input className={styles.search} style={{paddingLeft:40}} value={purpose} onChange={event=>{const value=event.target.value;setPurpose(value);setResultsOpen(normalize(value).length>=2)}} placeholder={placeholder}/></div>
      {resultsOpen&&results.length?<div className={styles.results}>{results.map(account=><button type="button" className={`${styles.result} ${account.code===accountCode?styles.resultActive:""}`} key={account.id} onClick={()=>{setAccountCode(account.code);setPurpose(account.label);setResultsOpen(false)}}><div><strong>{account.label}</strong><small>{fr?"Compte PCN officiel":"Official PCN account"} · {account.code}</small></div><span className={styles.crumb}>{groupLabel(account,fr)} &gt; {account.code}</span></button>)}</div>:resultsOpen&&purpose.trim().length>=2?<div className={styles.hint}>{fr?"Aucun résultat direct. Essayez des mots simples décrivant ce qui s’est passé.":"No direct match yet. Try simple words describing what happened."}</div>:!selected?<div className={styles.hint}>{fr?"Exemples : « avance fiscale », « j’ai mis de l’argent dans la société », « revenu YouTube » ou « frais Stripe ».":"Examples: “quarterly tax advance”, “I put money into the company”, “YouTube revenue” or “Stripe fee”."}</div>:null}
      {selected?<div className={styles.selected}><div><strong>{selected.label}</strong><small>{groupLabel(selected,fr)} · {fr?"Compte PCN":"PCN account"} {selected.code}</small></div><button type="button" className={styles.clear} onClick={()=>{setAccountCode("");setPurpose("");setResultsOpen(false)}}><X size={14}/> {fr?"Changer":"Change"}</button></div>:null}
      {selected?<div className={styles.preview}><div className={styles.previewHead}><Landmark size={14}/><span>{fr?"Aperçu comptable":"Posting preview"}</span><small>{isExpenseRefund?(fr?"Remboursement fournisseur":"Supplier refund"):["asset","liability"].includes(selected.account_type)?(fr?"Bilan":"Balance sheet"):selected.account_type==="expense"?(fr?"Charge":"P&L expense"):(fr?"Produit":"P&L revenue")}</small></div>{income?<><div className={styles.line}><span><b>5131</b> Bank</span><strong>Dr {money(gross,transaction.currency)}</strong></div><div className={styles.line}><span><b>{selected.code}</b> {selected.label}</span><strong>Cr {money(net,transaction.currency)}</strong></div>{vat>0?<div className={styles.line}><span><b>{isExpenseRefund?"421611":"461411"}</b> {isExpenseRefund?"Input VAT reversal":"Output VAT"}</span><strong>Cr {money(vat,transaction.currency)}</strong></div>:null}</>:<><div className={styles.line}><span><b>{selected.code}</b> {selected.label}</span><strong>Dr {money(net,transaction.currency)}</strong></div>{vat>0?<div className={styles.line}><span><b>421611</b> Input VAT</span><strong>Dr {money(vat,transaction.currency)}</strong></div>:null}<div className={styles.line}><span><b>5131</b> Bank</span><strong>Cr {money(gross,transaction.currency)}</strong></div></>}<div className={styles.balance}><CheckCircle2 size={13}/>{fr?"Débits et crédits équilibrés":"Debits and credits balance"} · {money(gross,transaction.currency)}</div></div>:null}
      {state.message?<div className={`${styles.message} ${state.status==="error"?styles.error:""}`}>{state.message}</div>:null}<button className={styles.submit} type="submit" disabled={pending||!selected}>{pending?<LoaderCircle className={styles.spin} size={15}/>:<LockKeyhole size={15}/>}<span>{pending?(fr?"Comptabilisation…":"Posting…"):(fr?"Comptabiliser":"Post to ledger")}</span></button>
    </form>
  </article>;
}
