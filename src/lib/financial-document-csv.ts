import { normalizeLocale } from "@/lib/i18n";

type Payload=Record<string,unknown>;
function obj(value:unknown){return value&&typeof value==="object"?value as Record<string,unknown>:null}
function arr(value:unknown){return Array.isArray(value)?value:[]}
function str(value:unknown){return typeof value==="string"?value:""}
function num(value:unknown){const n=Number(value);return Number.isFinite(n)?n:0}
function esc(value:unknown){const s=String(value??"");return /[",\n\r]/.test(s)?`"${s.replaceAll('"','""')}"`:s}
function lines(rows:unknown[][]){return rows.map(row=>row.map(esc).join(",")).join("\r\n")+"\r\n"}
function snapshot(payload:Payload){return obj(payload.ledger_snapshot)??{}}
function trial(payload:Payload){return arr(snapshot(payload).trial_balance).map(raw=>obj(raw)??{})}
function pl(payload:Payload){return obj(snapshot(payload).profit_and_loss)??{}}
function journalEntries(payload:Payload){return arr(obj(payload.journal)?.entries).length?arr(obj(payload.journal)?.entries):arr(obj(payload.general_ledger)?.entries)}
function closingSides(balance:number){return balance>=0?{debit:balance,credit:0}:{debit:0,credit:-balance}}
function T(payload:Payload){const fr=normalizeLocale(payload.locale)==="fr";return fr?{
 pcn:"PCN",account:"Compte",type:"Type",debitTurn:"Mouvement débit",creditTurn:"Mouvement crédit",closingDebit:"Solde débiteur",closingCredit:"Solde créditeur",section:"Section",amount:"Montant",revenue:"Produits",revenueTotal:"Total des produits",expense:"Charge",expenseTotal:"Total des charges",result:"Résultat",side:"Côté",assets:"Actif",liabilities:"Passif",equity:"Capitaux propres",resultYear:"Résultat de l'exercice",entry:"Écriture",date:"Date",entryDescription:"Description de l'écriture",source:"Source",lineDescription:"Description de la ligne",debit:"Débit",credit:"Crédit",currency:"Devise",runningDebit:"Solde progressif débiteur",runningCredit:"Solde progressif créditeur",description:"Description"
 }:{
 pcn:"PCN",account:"Account",type:"Type",debitTurn:"Debit turnover",creditTurn:"Credit turnover",closingDebit:"Closing debit",closingCredit:"Closing credit",section:"Section",amount:"Amount",revenue:"Revenue",revenueTotal:"Revenue total",expense:"Expense",expenseTotal:"Expense total",result:"Result",side:"Side",assets:"Assets",liabilities:"Liabilities",equity:"Equity",resultYear:"Result for the year",entry:"Entry",date:"Date",entryDescription:"Entry description",source:"Source",lineDescription:"Line description",debit:"Debit",credit:"Credit",currency:"Currency",runningDebit:"Running debit balance",runningCredit:"Running credit balance",description:"Description"
 }}

export function buildFinancialDocumentCsv(payload:Payload,documentType:string){
 const tb=trial(payload),t=T(payload);
 if(documentType==="trial_balance")return lines([[t.pcn,t.account,t.type,t.debitTurn,t.creditTurn,t.closingDebit,t.closingCredit],...tb.filter(r=>Math.abs(num(r.debit))>.005||Math.abs(num(r.credit))>.005).map(r=>{const side=closingSides(num(r.balance));return[str(r.code),str(r.label),str(r.account_type),num(r.debit).toFixed(2),num(r.credit).toFixed(2),side.debit?side.debit.toFixed(2):"",side.credit?side.credit.toFixed(2):""]})]);
 if(documentType==="pcn")return lines([[t.pcn,t.account,t.closingDebit,t.closingCredit],...tb.filter(r=>Math.abs(num(r.balance))>.005).map(r=>{const side=closingSides(num(r.balance));return[str(r.code),str(r.label),side.debit?side.debit.toFixed(2):"",side.credit?side.credit.toFixed(2):""]})]);
 if(documentType==="profit_loss"){
  const revenue=tb.filter(r=>str(r.account_type)==="revenue"&&Math.abs(num(r.balance))>.005),expenses=tb.filter(r=>str(r.account_type)==="expense"&&Math.abs(num(r.balance))>.005),p=pl(payload);
  return lines([[t.section,t.pcn,t.account,t.amount],...revenue.map(r=>[t.revenue,str(r.code),str(r.label),(num(r.credit)-num(r.debit)).toFixed(2)]),[t.revenueTotal,"","",num(p.revenue).toFixed(2)],...expenses.map(r=>[t.expense,str(r.code),str(r.label),(num(r.debit)-num(r.credit)).toFixed(2)]),[t.expenseTotal,"","",num(p.expenses).toFixed(2)],[t.result,"","",num(p.result).toFixed(2)]])
 }
 if(documentType==="balance_sheet"){
  const assets=tb.filter(r=>str(r.account_type)==="asset"&&Math.abs(num(r.balance))>.005),liabilities=tb.filter(r=>str(r.account_type)==="liability"&&Math.abs(num(r.balance))>.005),equity=tb.filter(r=>str(r.account_type)==="equity"&&Math.abs(num(r.balance))>.005),result=num(pl(payload).result);
  return lines([[t.side,t.pcn,t.account,t.amount],...assets.map(r=>[t.assets,str(r.code),str(r.label),num(r.balance).toFixed(2)]),...liabilities.map(r=>[t.liabilities,str(r.code),str(r.label),(-num(r.balance)).toFixed(2)]),...equity.map(r=>[t.equity,str(r.code),str(r.label),(-num(r.balance)).toFixed(2)]),[t.equity,"142",t.resultYear,result.toFixed(2)]])
 }
 if(documentType==="general_journal"){
  const out:unknown[][]=[[t.entry,t.date,t.entryDescription,t.source,t.pcn,t.account,t.lineDescription,t.debit,t.credit,t.currency]];
  for(const raw of journalEntries(payload)){const e=obj(raw)??{};for(const rawLine of arr(e.lines)){const l=obj(rawLine)??{};out.push([`J${String(num(e.entry_number)).padStart(4,"0")}`,str(e.entry_date),str(e.description),str(e.source_type),str(l.account_code),str(l.account_label),str(l.description),num(l.debit).toFixed(2),num(l.credit).toFixed(2),str(l.currency)])}}
  return lines(out)
 }
 if(documentType==="general_ledger"){
  type Movement={date:string;entry:number;description:string;debit:number;credit:number;currency:string};
  const groups=new Map<string,{code:string;label:string;type:string;movements:Movement[]}>();
  for(const raw of journalEntries(payload)){const e=obj(raw)??{};for(const rawLine of arr(e.lines)){const l=obj(rawLine)??{},code=str(l.account_code),key=code||str(l.account_label);if(!groups.has(key))groups.set(key,{code,label:str(l.account_label),type:str(l.account_type),movements:[]});groups.get(key)!.movements.push({date:str(e.entry_date),entry:num(e.entry_number),description:str(e.description)||str(l.description),debit:num(l.debit),credit:num(l.credit),currency:str(l.currency)})}}
  const out:unknown[][]=[[t.pcn,t.account,t.date,t.entry,t.description,t.debit,t.credit,t.runningDebit,t.runningCredit,t.currency]];
  for(const group of [...groups.values()].sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true}))){let running=0;group.movements.sort((a,b)=>a.date.localeCompare(b.date)||a.entry-b.entry);for(const movement of group.movements){running+=movement.debit-movement.credit;const side=closingSides(running);out.push([group.code,group.label,movement.date,`J${String(movement.entry).padStart(4,"0")}`,movement.description,movement.debit?movement.debit.toFixed(2):"",movement.credit?movement.credit.toFixed(2):"",side.debit?side.debit.toFixed(2):"",side.credit?side.credit.toFixed(2):"",movement.currency])}}
  return lines(out)
 }
 throw new Error("CSV is not available for this document type");
}
