"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { saveCompanySettings, type SettingsState } from "@/app/app/settings/actions";
import styles from "@/app/app/settings/settings.module.css";

const initial:SettingsState={status:"idle",message:""};
type Company={legal_name:string;trading_name:string|null;legal_form:string;rcs_number:string|null;vat_number:string|null;tax_number:string|null;business_permit_number:string|null;municipality:string|null;activity:string|null;fiscal_year_start_month:number;base_currency:string;vat_registered:boolean;vat_filing_frequency:string|null;registered_address:Record<string,unknown>};
function address(company:Company,key:string){const value=company.registered_address?.[key];return typeof value==="string"?value:""}
export function CompanySettingsForm({company}:{company:Company}){
 const[state,action,pending]=useActionState(saveCompanySettings,initial);
 return <form action={action} className={styles.form}>
  <section className={styles.formSection}><div className={styles.sectionTitle}><div><p>Company identity</p><h2>Legal details</h2></div><span>Used on invoices and company records</span></div><div className={styles.fields}>
   <label className={styles.full}><span>Legal company name</span><input name="legal_name" defaultValue={company.legal_name} required/></label>
   <label><span>Trading name</span><input name="trading_name" defaultValue={company.trading_name??""} placeholder="Optional public name"/></label>
   <label><span>Legal form</span><select name="legal_form" defaultValue={company.legal_form}><option value="SARL-S">SARL-S</option><option value="SARL">SARL</option><option value="SA">SA</option><option value="SOLE_TRADER">Sole trader</option><option value="OTHER">Other</option></select></label>
   <label><span>RCS number</span><input name="rcs_number" defaultValue={company.rcs_number??""} placeholder="B 123456"/></label>
   <label><span>Business permit</span><input name="business_permit_number" defaultValue={company.business_permit_number??""} placeholder="12345678 / 0"/></label>
   <label><span>VAT number</span><input name="vat_number" defaultValue={company.vat_number??""} placeholder="LU12345678"/></label>
   <label><span>Tax number</span><input name="tax_number" defaultValue={company.tax_number??""} placeholder="Optional ACD reference"/></label>
   <label className={styles.full}><span>Business activity</span><textarea name="activity" defaultValue={company.activity??""} rows={3} placeholder="Describe the company’s main activity"/></label>
  </div></section>
  <section className={styles.formSection}><div className={styles.sectionTitle}><div><p>Registered office</p><h2>Address</h2></div><span>Official business address</span></div><div className={styles.fields}>
   <label className={styles.full}><span>Street</span><input name="street" defaultValue={address(company,"street")} placeholder="12 rue du Commerce"/></label>
   <label><span>Postal code</span><input name="postal_code" defaultValue={address(company,"postal_code")} placeholder="L-1234"/></label>
   <label><span>City</span><input name="city" defaultValue={address(company,"city")} placeholder="Luxembourg"/></label>
   <label><span>Municipality</span><input name="municipality" defaultValue={company.municipality??""} placeholder="Luxembourg"/></label>
   <label><span>Country code</span><input name="country_code" defaultValue={address(company,"country_code")||"LU"} maxLength={2}/></label>
  </div></section>
  <section className={styles.formSection}><div className={styles.sectionTitle}><div><p>Accounting profile</p><h2>Financial settings</h2></div><span>Controls VAT and reporting defaults</span></div><div className={styles.fields}>
   <label><span>Base currency</span><select name="base_currency" defaultValue={company.base_currency}><option value="EUR">EUR · Euro</option><option value="USD">USD · US Dollar</option><option value="GBP">GBP · Pound sterling</option><option value="CHF">CHF · Swiss franc</option></select></label>
   <label><span>Fiscal year starts</span><select name="fiscal_year_start_month" defaultValue={String(company.fiscal_year_start_month)}>{Array.from({length:12},(_,index)=><option value={index+1} key={index}>{new Date(2026,index,1).toLocaleDateString("en-LU",{month:"long"})}</option>)}</select></label>
   <label className={styles.toggle}><span><strong>VAT registered</strong><small>Enable VAT accounting and filing workflows.</small></span><input name="vat_registered" type="checkbox" defaultChecked={company.vat_registered}/></label>
   <label><span>VAT filing frequency</span><select name="vat_filing_frequency" defaultValue={company.vat_filing_frequency??"annual"}><option value="annual">Annual</option><option value="quarterly">Quarterly</option><option value="monthly">Monthly</option></select></label>
  </div></section>
  <div className={styles.saveBar}>{state.message?<span className={state.status==="error"?styles.error:styles.success}>{state.message}</span>:<span>Changes update the company profile across Compta.</span>}<button type="submit" disabled={pending}>{pending?<LoaderCircle className={styles.spin} size={15}/>:<Check size={15}/>} {pending?"Saving…":"Save changes"}</button></div>
 </form>;
}
