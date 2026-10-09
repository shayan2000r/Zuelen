# Zuelen regulatory register

Every rate, threshold, deadline and accounting mapping that Zuelen uses, with where it lives and the
official Luxembourg source it must match.

- **Prepared:** 2026-10-09 (Phase 0B). **For review by:** a Luxembourg expert-comptable / réviseur.
- **Rule of use:** when a rule changes in code or in the database, update its row in the same change.
  A rule without an official source must not ship.
- Values were checked against the sources linked in each row on the preparation date. "Checked" means
  the official document was read in this session; secondary sources are named as such.

### Status legend

| Status | Meaning |
| --- | --- |
| ✅ Matches | Zuelen's value matches the official source |
| ⚠️ Mismatch | Zuelen's value or behaviour differs from the official source — fix in Phase 1 |
| ❌ Missing | The rule applies to Zuelen's users but is not implemented |
| 🟡 Partial | Implemented, but simplified, not dated, or only partly verifiable — accountant to confirm |
| 🔍 Source needed | Implemented, official source not yet located or read |

### Summary

| Area | ✅ | ⚠️ | ❌ | 🟡 | 🔍 |
| --- | --- | --- | --- | --- | --- |
| A. VAT (TVA) | 4 | 2 | 3 | 2 | 1 |
| B. Corporate direct taxes | 3 | 1 | 0 | 2 | 0 |
| C. CCSS (independents) | 6 | 2 | 0 | 2 | 1 |
| D. Accounting (PCN) | 2 | 0 | 0 | 2 | 0 |
| E. Compliance calendar | 3 | 1 | 2 | 0 | 0 |
| F. Personal tax (independents) | 0 | 0 | 0 | 0 | 1 |
| G. Invoicing mentions | 1 | 0 | 0 | 0 | 1 |

Rows that only point to another row (E5, G3, G4) and the structural note E8 are not counted.
| H. Bookkeeping law | 0 | 0 | 0 | 0 | 1 |

---

## A. VAT (TVA) — Administration de l'enregistrement, des domaines et de la TVA (AED)

Legal basis: loi modifiée du 12 février 1979 concernant la taxe sur la valeur ajoutée (LTVA).

| ID | Rule | Zuelen value | Where in Zuelen | Official value | Source | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | VAT rates | 17 / 14 / 8 / 3 % (+ 0 for exempt/zero) | `src/components/source-transaction-form.tsx`, `transaction-row-actions.tsx`, `invoice-composer.tsx`, `src/app/app/vat/page.tsx`; DB `create_and_issue_service_invoice` ("Unsupported Luxembourg VAT rate") | 17 / 14 / 8 / 3 % since 1 Jan 2024 | European Commission, [VAT rate changes on 1 January 2024](https://trade.ec.europa.eu/access-to-markets/fr/news/modifications-des-taux-de-tva-applicables-au-1-janvier-2024-dans-certains-etats-membres-de-lue); LTVA art. 39–40 (to read on legilux) | ✅ Matches | Hard-coded in ≥5 places with no effective dates. The temporary 2023 rates (16 / 13 / 7 %) cannot be entered, so FY2023 bookkeeping would be wrong. |
| A2 | Filing frequency by annual turnover | annual < €112,000; quarterly €112,000–620,000; monthly > €620,000 | DB `compliance_rules` (`vat_annual.parameters`); the user selects the frequency the AED assigned (`companies.vat_filing_frequency`) | Same thresholds | [guichet.lu — VAT return](https://guichet.public.lu/en/entreprises/fiscalite/impots-benefices/tva/declarations/declaration-tva.html) (updated 20.01.2023) | ✅ Matches | Thresholds are informational; frequency is assigned by the AED. |
| A3 | Monthly / quarterly return deadline | 15th of the following month / quarter | DB `sync_core_compliance_calendar` | "before the 15th day of the month (quarter) following" | guichet.lu (as A2) | ✅ Matches | Accountant to confirm whether "before the 15th" means the 15th is the last day. |
| A4 | Annual return deadline | 1 March (annual filers); 1 May (monthly/quarterly filers) | DB `sync_core_compliance_calendar` | "**before** 1 March" / "**before** 1 May" of the following year | guichet.lu (as A2) | ⚠️ Mismatch | Due dates are set **on** 1 March / 1 May. Safer: last day of February / 30 April. |
| A5 | EU recapitulative statement (état récapitulatif) | Rule stored (25th) but **no deadline is ever generated** | DB `compliance_rules.eu_recap`; not used by `sync_core_compliance_calendar` | Before the 25th of the month following the period; monthly by default, quarterly allowed for goods ≤ €50,000/quarter, services may choose quarterly | [guichet.lu — recapitulative statements](https://guichet.public.lu/en/entreprises/fiscalite/impots-benefices/tva/declarations/etats-recapitulatifs.html) (updated 19.01.2023) | ❌ Missing | Needed for every user who invoices EU B2B with reverse charge (which Zuelen supports). |
| A6 | Small-business franchise | Not modelled | — | National threshold €50,000 from 1 Jan 2025 (10 % tolerance, i.e. €55,000, in the year of exceeding); EU threshold €100,000 for the cross-border scheme | AED, [FAQ régime de franchise (SME)](https://pfi.public.lu/dam-assets/pdf/tva/sme/faq-fr.pdf) | ❌ Missing | Most relevant to Independents. No turnover monitoring or warning when approaching €50,000 / €55,000. |
| A7 | Invoice mention for franchise users | Not printed | `invoice-composer.tsx`, `src/app/app/invoices/[id]/page.tsx` | "TVA non applicable – Article 57bis de la loi modifiée du 12 février 1979" | AED FAQ (as A6) | ❌ Missing | Non-VAT-registered issuers currently get no exemption mention. |
| A8 | EU B2B reverse charge on sales | VAT 0 %, customer VAT number required, not allowed for LU customers, mention "AUTO-LIQUIDATION · REVERSE CHARGE" | DB `create_and_issue_service_invoice`, `invoice-composer.tsx` | Reverse charge with "Autoliquidation" mention | LTVA invoicing rules (article to confirm) | 🔍 Source needed | Behaviour looks right; exact legal article and wording to confirm. VIES validation of customer VAT numbers is not done. |
| A9 | Reverse charge on EU B2B purchases | Self-assessed: debit 421611 / credit 461411 at the transaction's rate | DB `classify_and_post_source_transaction` (lines `RC_INPUT`, `RC_OUTPUT`) | Self-assessment of output VAT with matching deduction where deductible | LTVA (article to confirm) | 🟡 Partial | Assumes full right to deduct. |
| A10 | VAT ledger accounts | Input 421611 "TVA en amont"; output 461411 "TVA en aval" | DB posting functions, `prepare_vat_filing`, `src/app/app/taxes/page.tsx` | Accounts exist in PCN 2020 with these labels | eCDF PCN mapping (see D1) | ✅ Matches | |
| A11 | VAT return content | Only output VAT, input VAT and net totals (`LU-VAT-2026.1`), flagged "manual review required" | DB `prepare_vat_filing`, `src/app/app/vat/page.tsx` | Official return form (eCDF `TVA_DECM` / `TVA_DECT` / `TVA_DECA`) has many boxes (turnover by rate, intra-EU, exempt, reverse charge…) | eCDF specifications (to collect) | 🟡 Partial | The app does not produce the official box layout. Decide whether that is in scope for launch. |
| A12 | Exempt activities / partial deduction (pro-rata) / non-deductible VAT | Not modelled; "exempt_or_zero" mixes exempt and zero-rated | `src/app/app/transactions/actions.ts` (`treatments`) | LTVA art. 44 exemptions remove the right to deduct; mixed activities use a pro-rata | LTVA (to read) | ⚠️ Mismatch | Users with exempt activities (e.g. medical, financial, letting) would over-deduct input VAT. |

## B. Corporate direct taxes — Administration des contributions directes (ACD)

| ID | Rule | Zuelen value | Where in Zuelen | Official value | Source | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B1 | Corporate income tax (IRC) scale | ≤ €175,000: 14 %; €175,000–200,001: €24,500 + 30 % of the excess; above: 16 % | `irc()` in `src/app/app/taxes/page.tsx` | Same, from tax year 2025 | ACD, [Tarif applicable aux collectivités](https://impotsdirects.public.lu/fr/az/t/tarif-applicable-collectivites/tarif-collect.html); [Charge fiscale](https://impotsdirects.public.lu/fr/az/c/charg_fisc.html) (updated 19.12.2025) | ✅ Matches | |
| B2 | IRC scale is not dated | One scale for every year | as B1 | 2019–2024: 15 % / €26,250 + 31 % / 17 %; a further 1-point cut is announced for 2027 | ACD (as B1); Chamber reply QP 62533 (Mar 2026) | ⚠️ Mismatch | Selecting FY2024 or earlier gives a wrong estimate. Needs dated parameters, as CCSS has. |
| B3 | Employment fund surcharge | 7 % of IRC | `src/app/app/taxes/page.tsx` | 7 % for companies (1.12 points on 16 %) | ACD [Charge fiscale](https://impotsdirects.public.lu/fr/az/c/charg_fisc.html) | ✅ Matches | |
| B4 | Municipal business tax (ICC) | 3 % × communal multiplier on (profit − €17,500); multiplier entered by the user per year | `src/app/app/taxes/page.tsx`, `company_tax_profiles.icc_multiplier` | 3 % × multiplier; deduction €17,500 for IRC taxpayers (€40,000 for others) | ACD, [Calcul de l'impôt commercial](https://impotsdirects.public.lu/fr/az/c/calc_comm.html) | ✅ Matches | |
| B5 | Minimum net wealth tax | €535 (balance sheet ≤ €350,000), €1,605 (≤ €2,000,000), €4,815 (above) | `src/app/app/taxes/page.tsx` | Same brackets from tax year 2025 (§ 8 VStG, after Constitutional Court ruling 10.11.2023) | ACD, [Tarif IF collectivités](https://impotsdirects.public.lu/fr/az/t/tarif-applicable-collectivites/tarif-collect-if.html) (to read directly); bill 8388 | 🟡 Partial | Confirmed through secondary sources; ACD page to read directly. |
| B6 | Taxable profit used for the estimate | Revenue − operating expenses (excluding 6711, 6721, 6811) | `src/app/app/taxes/page.tsx` | Taxable income includes non-deductible expenses, exempt income, losses carried forward, etc. | LIR | 🟡 Partial | Fine as a clearly labelled estimate; the label must say so. |

## C. CCSS — social contributions of independents

Source for all 1 Jan 2026 values: CCSS, [Avis aux non-salariés — taux de cotisation au 01.01.2026](https://ccss.public.lu/dam-assets/publications/2026/ccss-20260313-avis-60-fr-de.pdf) (13.03.2026), and IGSS, [Paramètres sociaux 01.01.2026](https://igss.gouvernement.lu/dam-assets/publications/param%C3%A8tres-sociaux/2026/par-soc-202601.pdf) (index 968.04). June values: IGSS, [Paramètres sociaux 01.06.2026](https://igss.gouvernement.lu/dam-assets/publications/param%C3%A8tres-sociaux/2026/par-soc-202606.pdf) (index 992.24).

Zuelen stores these in `src/lib/ccss/parameters.ts` **and** the DB table `ccss_parameter_periods` (two copies that must stay identical).

| ID | Rule | Zuelen value | Official value | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| C1 | Minimum social wage (SSM), 1 Jan–31 May 2026 | €2,703.74 | €2,703.74 | ✅ Matches | |
| C2 | SSM from 1 Jun 2026 | €2,771.33 | €2,771.33 | ✅ Matches | |
| C3 | Minimum base, secondary activity (1/3 SSM) | €901.25 / €923.78 | €901.25 (CCSS); June not published in the documents read (2,771.33 ÷ 3 = 923.78) | 🟡 Partial | June value computed, not read from a CCSS notice. |
| C4 | Maximum base (5 × SSM) | €13,518.68 / €13,856.63 | €13,518.68 / €13,856.63 | ✅ Matches | |
| C5 | Maximum income of assisting spouse (2 × SSM) | €5,407.47 / €5,542.65 | €5,407.47 (CCSS); June not found | 🟡 Partial | Confirm June value with the CCSS. |
| C6 | Care-insurance (dépendance) deduction, 1/4 SSM, Jan–May 2026 | **€675.94** | **€675.93** | ⚠️ Mismatch | Fix in both `parameters.ts` and `ccss_parameter_periods`. |
| C7 | Care-insurance deduction from 1 Jun 2026 | €692.83 | €692.83 | ✅ Matches | |
| C8 | Contribution rates | Health 5.60 %, cash benefits 0.50 %, pension 17.00 %, care 1.40 %, accident base 0.65 % × bonus-malus factor, employers' mutual insurance (MDE) classes 0.23 / 0.95 / 1.56 / 2.66 % | Same (pension 17 % follows the law of 18.12.2025 raising the total rate from 24 % to 25.5 %) | ✅ Matches | |
| C9 | Care insurance ignores the minimum and maximum base | No cap or minimum on the care base | Minimum and maximum do not apply to care insurance | ✅ Matches | |
| C10 | Parameters only cover 2026 | Last period ends 2026-12-31; the calculator throws for later months | — | ⚠️ Mismatch | 2027 parameters (and every index change) must be added; there is no monitoring yet. |
| C11 | Exemption for insignificant income | Exemption applies when approved and income < 1/3 SSM | — | 🔍 Source needed | Find the CCSS rule and threshold for the "dispense pour revenu insignifiant". |

## D. Accounting — Plan comptable normalisé (PCN)

| ID | Rule | Zuelen value | Where in Zuelen | Official value | Source | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D1 | Chart of accounts | PCN 2020 catalogue: 756 accounts, 293 groups, labels in FR/EN | DB `pcn_accounts`, `pcn_account_groups`; `db/migrations/20260901140*` | PCN set by règlement grand-ducal of 12 Sept 2019, for financial years starting on or after 1 Jan 2020; eCDF publishes yearly standard mapping tables up to 2026 | [guichet.lu — chart of accounts](https://guichet.public.lu/en/entreprises/gestion-juridique-comptabilite/gestion-financiere-comptabilite/enregistrement-comptable/plan-comptable.html); [eCDF mapping tables](https://ecdf.b2g.etat.lu/ecdf/pcnMappingTables) | 🟡 Partial | Production catalogue was checked against eCDF's 2026 standard mapping when it was built. The reproducible seed uses Odoo's chart as a secondary source (see audit). Accountant to spot-check. |
| D2 | Accounts used by automatic postings | 4011 Clients, 5131 Banques, 7033 Prestations de services, 6562 / 7562 FX losses / gains, 6711 IRC, 6721 ICC, 6811 IF, 6132, 61333, 61334, 61348, 6151, 6481, 4712, 42148 | DB posting, invoicing, payment and bank-classification functions | All exist in the PCN 2020 catalogue with matching labels | as D1 | ✅ Matches | Whether each is the *right* account for each situation is a Phase 1 question. |
| D3 | Shareholder current account direction | 4712 (liability) | DB migrations `2026090208450*` | PCN 4712 "Dettes envers associés et actionnaires" | as D1 | ✅ Matches | |
| D4 | Default revenue account for all service invoices | 7033 | DB invoicing functions | PCN distinguishes 7031/7032/7033 by type of service | as D1 | 🟡 Partial | Fine for most users; let users pick when needed. |

## E. Compliance calendar

| ID | Rule | Zuelen value | Where in Zuelen | Official value | Source | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E1 | Approve annual accounts | 6 months after year end | DB `sync_core_compliance_calendar` | Within 6 months after year end | [guichet.lu — filing annual accounts](https://guichet.public.lu/en/entreprises/gestion-juridique-comptabilite/registre-commerce/depots-publications/depot-comptes-annuels.html) (updated 07.05.2026) | ✅ Matches | |
| E2 | File annual accounts with the RCS | 7 months after year end (outer limit) | as E1 | Within 1 month after approval, so 7 months at the latest | as E1 | ✅ Matches | |
| E3 | Who must file annual accounts | Only legal forms SARL-S, SARL, SA | as E1 | All capital companies (SA, SARL, SAS, SCA, SE, cooperatives), partnerships and sole traders with turnover > €100,000, branches, ASBLs | as E1 | ⚠️ Mismatch | Setup offers **SAS and SCA**, but they get no annual-accounts or Model 500 deadlines. |
| E4 | Corporate tax return (Model 500) | 31 December of year N+1 | as E1 | 31 December of the following year (since tax year 2022) | ACD, [Déclaration collectivités](https://impotsdirects.public.lu/fr/echanges_electroniques/decl_coll.html) | ✅ Matches | Only generated when the financial year starts in January. |
| E5 | VAT deadlines | see A3–A5 | | | | ✅ / ⚠️ / ❌ | |
| E6 | Income tax obligations of independents | Not generated | — | Personal return (Model 100) by 31 December N+1; quarterly advances on 10 March / June / September / December, as set by the ACD | guichet.lu, [Payer l'impôt dû par les indépendants](https://guichet.public.lu/fr/citoyens/fiscalite/declaration-impot-decompte/paiement-impot/payer-impot-du-independant.html) | ❌ Missing | Core need for the Independent workspace. |
| E7 | Other recurring obligations | Not generated | — | CCSS payments, corporate tax advances, net wealth tax, register of beneficial owners updates, etc. | various | ❌ Missing | Scope to decide for launch. |
| E8 | Single source of truth for calendar rules | Values exist both in `compliance_rules` and hard-coded in `sync_core_compliance_calendar` | DB | — | — | (structure) | The function should read `compliance_rules` so the dated, sourced row is what drives deadlines. |

## F. Personal tax (independents)

| ID | Rule | Zuelen value | Where in Zuelen | Official value | Source | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F1 | Tax class derivation (1, 1a, 2; 3-year transitional class 2 after divorce, separation or widowhood) | Rules in code | `src/lib/personal-fiscal/tax-class.ts` | LIR art. 119 | To read on legilux / impotsdirects | 🔍 Source needed | Non-residents correctly return "needs confirmation". Watch the announced move to a single tax class. Zuelen deliberately does not estimate personal income tax. |

## G. Invoicing mentions

| ID | Rule | Zuelen value | Where in Zuelen | Official value | Source | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G1 | Required data before issuing | Issuer VAT number (if charging VAT), registered address, customer name, address and country, line descriptions, issue/service/due dates, sequential number at issue, locked period check | DB `issue_service_invoice_draft`, `create_and_issue_service_invoice` | LTVA invoicing rules | LTVA (article to confirm) | ✅ Matches | Behaviour matches the usual list; exact article to cite. |
| G2 | RCS number and business permit on invoices | Printed; warning shown when missing on invoices over €100 incl. VAT | `invoice-composer.tsx`, `src/lib/invoice-compliance.ts` | — | Code de commerce / loi du 2 septembre 2011 (to confirm) | 🔍 Source needed | Where does the €100 threshold come from? |
| G3 | Franchise mention | see A7 | | | | ❌ | |
| G4 | Reverse charge mention | see A8 | | | | 🔍 | |

## H. Bookkeeping law

| ID | Rule | Zuelen value | Where in Zuelen | Official value | Source | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H1 | Keep books and supporting documents | Not enforced; `reset_company_bookkeeping` and `reset_financial_year` allow wiping a year | DB functions | 10-year retention (Code de commerce art. 16) | To read on legilux | 🔍 Source needed | Once the source is confirmed, reset or delete of closed periods should be blocked for live users. |

---

## Not a rule, but a gap: annual accounts output

Zuelen generates financial documents (`generated_documents`), but the official filing is a structured eCDF
file for the RCS (balance sheet, P&L and, under a June 2025 draft regulation, PCN balances). Its format
and the abridged/full thresholds must be added to this register in Phase 1 before "annual accounts" is
offered as a filing-ready document.
