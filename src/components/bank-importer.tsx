"use client";

import { FileSpreadsheet, LoaderCircle, UploadCloud } from "lucide-react";
import { useActionState, useMemo, useRef, useState } from "react";
import { importBankRows, type BankImportState } from "@/app/app/banking/actions";
import styles from "./banking.module.css";

type NormalizedRow = {
  booking_date: string;
  value_date?: string | null;
  amount: number;
  currency?: string;
  counterparty_name?: string | null;
  counterparty_iban?: string | null;
  reference?: string | null;
  external_id?: string | null;
};

const initial: BankImportState = { status: "idle", message: "" };
const aliases = {
  date: ["bookingdate","booking_date","date","datum","buchungstag","dateoperation","datedoperation","datecomptable"],
  valueDate: ["valuedate","value_date","valutadatum","datevaleur"],
  amount: ["amount","montant","betrag","value","transactionamount"],
  debit: ["debit","débit","debitamount","montantdebit"],
  credit: ["credit","crédit","creditamount","montantcredit"],
  currency: ["currency","devise","wahrung","währung"],
  counterparty: ["counterparty","counterpartyname","beneficiary","beneficiaire","bénéficiaire","name","nom","partner"],
  iban: ["counterpartyiban","ibanbeneficiary","ibanbeneficiaire","iban"],
  reference: ["reference","communication","description","details","libelle","libellé","memo","purpose","remittanceinformation"],
  external: ["transactionid","externalid","external_id","id","referenceid"],
};

function norm(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function findIndex(headers: string[], names: string[]) { const normalized=headers.map(norm); return normalized.findIndex(item=>names.map(norm).includes(item)); }
function delimiter(firstLine: string) { const candidates=[",",";","\t"]; return candidates.sort((a,b)=>(firstLine.split(b).length-firstLine.split(a).length))[0] ?? ","; }
function parseLine(line: string, sep: string) { const out:string[]=[]; let current="", quoted=false; for(let i=0;i<line.length;i++){const ch=line[i]; if(ch==='"'){if(quoted&&line[i+1]==='"'){current+='"';i++;}else quoted=!quoted;}else if(ch===sep&&!quoted){out.push(current.trim());current="";}else current+=ch;} out.push(current.trim()); return out; }
function parseNumber(raw: string) { let value=(raw||"").trim().replace(/\s/g,"").replace(/[€$£]/g,""); if(!value)return 0; const comma=value.lastIndexOf(","),dot=value.lastIndexOf("."); if(comma>dot)value=value.replace(/\./g,"").replace(",","."); else if(dot>comma)value=value.replace(/,/g,""); else value=value.replace(",","."); value=value.replace(/[^0-9.-]/g,""); return Number(value); }
function parseDate(raw: string) { const value=(raw||"").trim(); if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value; const m=value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/); if(!m)return null; return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`; }

function normalizeCsv(text: string): { rows: NormalizedRow[]; message: string; headers: string[] } {
  const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(line=>line.trim()); if(lines.length<2)return{rows:[],message:"The CSV needs a header row and at least one transaction.",headers:[]};
  const sep=delimiter(lines[0]); const headers=parseLine(lines[0],sep);
  const dateI=findIndex(headers,aliases.date), valueDateI=findIndex(headers,aliases.valueDate), amountI=findIndex(headers,aliases.amount), debitI=findIndex(headers,aliases.debit), creditI=findIndex(headers,aliases.credit), currencyI=findIndex(headers,aliases.currency), counterpartyI=findIndex(headers,aliases.counterparty), ibanI=findIndex(headers,aliases.iban), referenceI=findIndex(headers,aliases.reference), externalI=findIndex(headers,aliases.external);
  if(dateI<0)return{rows:[],message:"I couldn't detect a booking-date column. Rename it to Date or Booking date and try again.",headers};
  if(amountI<0 && debitI<0 && creditI<0)return{rows:[],message:"I couldn't detect an Amount column (or separate Debit/Credit columns).",headers};
  const rows:NormalizedRow[]=[];
  for(const line of lines.slice(1)){const cells=parseLine(line,sep),date=parseDate(cells[dateI]||""); if(!date)continue; let amount=amountI>=0?parseNumber(cells[amountI]||""):0; if(amountI<0){const debit=debitI>=0?Math.abs(parseNumber(cells[debitI]||"")):0,credit=creditI>=0?Math.abs(parseNumber(cells[creditI]||"")):0; amount=credit-debit;} if(!Number.isFinite(amount)||amount===0)continue; rows.push({booking_date:date,value_date:valueDateI>=0?parseDate(cells[valueDateI]||""):null,amount,currency:currencyI>=0?(cells[currencyI]||"").trim().toUpperCase():undefined,counterparty_name:counterpartyI>=0?(cells[counterpartyI]||"").trim()||null:null,counterparty_iban:ibanI>=0?(cells[ibanI]||"").trim()||null:null,reference:referenceI>=0?(cells[referenceI]||"").trim()||null:null,external_id:externalI>=0?(cells[externalI]||"").trim()||null:null});}
  return{rows,message:rows.length?`${rows.length} valid transaction${rows.length===1?"":"s"} detected.`:"No valid transactions were detected.",headers};
}

export function BankImporter({ defaultCurrency }: { defaultCurrency: string }) {
  const [state, action, pending]=useActionState(importBankRows,initial); const fileInput=useRef<HTMLInputElement>(null); const[fileName,setFileName]=useState(""); const[rows,setRows]=useState<NormalizedRow[]>([]); const[parseMessage,setParseMessage]=useState<string|null>(null);
  const preview=useMemo(()=>rows.slice(0,5),[rows]);
  async function choose(file:File|null){if(!file)return;setFileName(file.name);if(file.size>4*1024*1024){setRows([]);return setParseMessage("Keep CSV files under 4 MB per import.");}const result=normalizeCsv(await file.text());setRows(result.rows);setParseMessage(result.message);}
  return <aside className={styles.importCard}><div className={styles.importHead}><div><p>Statement intake</p><h2>Import bank CSV</h2></div><span><FileSpreadsheet size={14}/>CSV</span></div><p className={styles.lead}>Compta detects common date, amount, debit/credit, currency, counterparty and reference columns. Duplicate rows are skipped automatically.</p><form action={action} className={styles.importForm}>
    <div className={styles.accountGrid}><label><span>Account name</span><input name="account_name" placeholder="e.g. Business current account" required/></label><label><span>IBAN <em>optional</em></span><input name="iban" placeholder="LU00 0000 0000 0000 0000"/></label><label><span>Currency</span><input name="currency" defaultValue={defaultCurrency||"EUR"} maxLength={3}/></label></div>
    <button type="button" className={styles.dropzone} onClick={()=>fileInput.current?.click()}><input ref={fileInput} hidden type="file" accept=".csv,text/csv" onChange={event=>choose(event.target.files?.[0]??null)}/><UploadCloud size={22}/><strong>{fileName||"Choose a bank CSV"}</strong><small>{fileName?parseMessage||"Reading file…":"CSV export from your bank · max 4 MB"}</small></button>
    {preview.length>0?<div className={styles.preview}><div className={styles.previewHead}><span>Preview</span><strong>{rows.length} rows ready</strong></div>{preview.map((row,index)=><div className={styles.previewRow} key={`${row.booking_date}-${index}`}><span>{row.booking_date}</span><span>{row.counterparty_name||row.reference||"Bank movement"}</span><strong className={row.amount>=0?styles.moneyIn:styles.moneyOut}>{row.amount>=0?"+":"−"}{Math.abs(row.amount).toFixed(2)} {row.currency||defaultCurrency}</strong></div>)}</div>:null}
    <input type="hidden" name="file_name" value={fileName}/><input type="hidden" name="rows_json" value={JSON.stringify(rows)}/>
    {(state.message||parseMessage)?<div className={`${styles.message} ${state.status==="error"||(!rows.length&&parseMessage)?styles.error:""}`}>{state.message||parseMessage}</div>:null}
    <button className={styles.importButton} type="submit" disabled={pending||rows.length===0}>{pending?<LoaderCircle className={styles.spin} size={15}/>:<UploadCloud size={15}/>} {pending?"Importing…":"Import & review"}</button>
  </form></aside>;
}
