# Zuelen regulatory register

Every rate, threshold, deadline and accounting mapping that Zuelen uses, with where it lives and the
official Luxembourg source it must match.

- **First prepared:** 2026-10-09 (Phase 0B). **Updated:** 2026-10-09, after the fixes below.
- **Rule of use:** when a rule changes in code or in the database, update its row in the same change.
  A rule without an official source must not ship.
- "Checked" means the official document was read on the date above; secondary sources are named as such.
- Rules live in one place per layer: `src/lib/tax-rules/*`, `src/lib/ccss/parameters.ts` and the
  database tables `vat_rate_periods`, `compliance_rules`, `ccss_parameter_periods` (see `db/README.md`).

### Status legend

| Status | Meaning |
| --- | --- |
| ✅ Matches | Zuelen's value matches the official source |
| ⏳ Fixed, pending approval | Fix written and tested; in `db/pending/`, waiting for a person to run it in the Supabase SQL editor |
| ⚠️ Mismatch | Zuelen differs from the official source |
| ❌ Missing | The rule applies to Zuelen's users but is not implemented |
| 🟡 Partial | Implemented, but simplified or only confirmed through secondary sources |
| 🔍 Source needed | Implemented, official source not yet located |

### Summary

| Area | ✅ | ⏳ | ⚠️ | ❌ | 🟡 | 🔍 |
| --- | --- | --- | --- | --- | --- | --- |
| A. VAT (TVA) | 10 | 0 | 0 | 0 | 2 | 0 |
| B. Corporate direct taxes | 4 | 0 | 0 | 0 | 2 | 0 |
| C. CCSS (independents) | 9 | 0 | 0 | 0 | 2 | 0 |
| D. Accounting (PCN) | 2 | 0 | 0 | 0 | 2 | 0 |
| E. Compliance calendar | 7 | 0 | 0 | 0 | 1 | 0 |
| F. Personal tax (independents) | 1 | 0 | 0 | 0 | 0 | 0 |
| G. Invoicing mentions | 3 | 0 | 0 | 0 | 1 | 0 |
| H. Bookkeeping law | 1 | 0 | 0 | 0 | 0 | 0 |

Before the fixes: 19 ✅, 6 ⚠️, 5 ❌, 8 🟡, 5 🔍.

---

## A. VAT (TVA) — Administration de l'enregistrement, des domaines et de la TVA (AED)

Legal basis: loi modifiée du 12 février 1979 concernant la taxe sur la valeur ajoutée (LTVA).

| ID | Rule | Zuelen | Official | Source | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | VAT rates by date of supply | `vat_rate_periods` (DB) and `src/lib/tax-rules/vat.ts`: 17/14/8/3 % (2015–2022, from 2024), 16/13/7/3 % (2023), 0 %. Rate pickers follow the transaction / service date; DB validates by date. | Same | European Commission, [VAT rates from 1 January 2024](https://trade.ec.europa.eu/access-to-markets/fr/news/modifications-des-taux-de-tva-applicables-au-1-janvier-2024-dans-certains-etats-membres-de-lue); LTVA art. 39–40 | ✅ | |
| A2 | Filing frequency thresholds | annual < €112,000; quarterly to €620,000; monthly above (settings map the turnover bracket; the AED assignment prevails) | Same | [guichet.lu — VAT return](https://guichet.public.lu/fr/entreprises/fiscalite/impots-benefices/tva/declarations/declaration-tva.html) (20.01.2023) | ✅ | |
| A3 | Monthly / quarterly return | Due date shown: 14th of the following month / quarter | "avant le 15e jour du mois (trimestre) qui suit" | as A2 | ✅ | Shown as the last day that complies with "before". |
| A4 | Annual return | Last day of February (annual filers); 30 April (monthly / quarterly filers) | "avant le 1er mars" / "avant le 1er mai" | as A2 | ✅ | Was 1 March / 1 May. Existing open deadlines were moved. |
| A5 | EU recapitulative statement | One obligation per month (or quarter, if chosen in settings) with a B2B supply to a customer in another EU Member State (customers outside the EU do not count); due the 24th of the following month | "avant le 25e jour du mois qui suit la période déclarative"; monthly by default, quarterly allowed for services and for goods ≤ €50,000/quarter | [guichet.lu — recapitulative statements](https://guichet.public.lu/fr/entreprises/fiscalite/impots-benefices/tva/declarations/etats-recapitulatifs.html) (19.01.2023) | ✅ | |
| A6 | Small-business franchise | Settings: "supplies without VAT → franchise"; tax pages show turnover against €50,000 (+10 % tolerance) and what happens when exceeded | €50,000 from 1 Jan 2025 (10 % tolerance in the year of exceeding, excluded the next year; above €55,000 it ends the next day); €35,000 before 2025; EU limit €100,000 | AED, [FAQ régime de franchise](https://pfi.public.lu/dam-assets/pdf/tva/sme/faq-fr.pdf) | ✅ | Turnover = class 70 revenue posted in the calendar year. |
| A7 | Franchise invoice mention | Stored on the invoice at issue and printed: "TVA non applicable – Article 57bis de la loi modifiée du 12 février 1979" | Same wording | AED FAQ (as A6) | ✅ | Applies when the business is under the franchise or not VAT registered. |
| A8 | Mention for a business customer abroad | EU customer: "Autoliquidation" stored at issue, customer VAT number required. Customer outside the EU: "TVA non applicable – prestation de services à un preneur assujetti établi hors de l'Union européenne", no VAT number required. Not allowed for LU customers. | "Autoliquidation" when the customer is liable for the VAT (EU) | Fiduciaire LPG, [VAT compulsory information on invoices](https://www.fiduciaire-lpg.lu/en/publications/vat/vat-compulsory-information-invoices) (secondary); place of supply for B2B services: art. 17/1/b as cited on the official return [TVA_DECM 2026](https://ecdf.b2g.etat.lu/ecdf/formdocs/2026/TVA_DECM/2026M1V002/TVA_DECM_FORMSTATIC_FR_2026M01_2026M1V002.pdf) | 🟡 | "Autoliquidation" confirmed through a secondary source. The outside-EU wording is factual, not an official formula. Customer VAT numbers are not checked against VIES. Draft-save change: migration 20261009130000. |
| A9 | Reverse charge on EU B2B purchases (services) and intra-Community acquisitions (goods) | Buyer self-assesses Luxembourg VAT at the Luxembourg rate on the amount paid: output VAT in full (461411), input VAT according to the deduction right, any non-deductible part added to the cost. A purchase with no self-assessed VAT is not posted. A sale to an EU business carries no Luxembourg VAT. | B2B services are taxed where the customer is established; the customer self-assesses the VAT | LTVA art. 17 (place of supply); Chambre des Députés, [doc. parl. on the 2010 place-of-supply reform](https://wdocs-pub.chd.lu/docs/exped/007/834/080363.pdf) | ✅ | Tested: pro-rata 60 % on €170 VAT gives €102 deducted, €68 added to the expense; goods acquisition €200 gives €34 output and €34 input VAT. |
| A10 | VAT ledger accounts | 421611 "TVA en amont", 461411 "TVA en aval" | In PCN 2020 | eCDF PCN mapping | ✅ | |
| A11 | VAT return content | The VAT page computes the official boxes for the period (monthly [TVA_DECM 2026](https://ecdf.b2g.etat.lu/ecdf/formdocs/2026/TVA_DECM/2026M1V002/TVA_DECM_FORMSTATIC_FR_2026M01_2026M1V002.pdf), quarterly [TVA_DECT 2026](https://ecdf.b2g.etat.lu/ecdf/formdocs/2026/TVA_DECT/2026M1V002/TVA_DECT_FORMSTATIC_FR_2026Q01_2026M1V002.pdf) and annual [TVA_DECA 2025](https://ecdf.b2g.etat.lu/ecdf/formdocs/2025/TVA_DECA/2025M1V002/TVA_DECA_FORMSTATIC_FR_2025_2025M1V002.pdf) layouts) from issued invoice lines and posted transactions, checks them against the VAT ledger accounts (461411 / 421611), lists anything it cannot place in a box (no guess), and freezes the boxes in the filing snapshot. The user files on eCDF / MyGuichet. | Official eCDF forms; monthly and quarterly forms have identical boxes | AED / eCDF forms (linked) | ✅ | Covered: 012, 454/472 (DECM/DECT) or 001/002/004/007 (DECA), 021 with 457/013, 014, 016, 019, 423, 481; 022; 037/046 and rate boxes; 051/056 and 711–916; 409/410, 436/462, 463/464 and 741–956; 076; 093 with 458/459/461 (DECM/DECT) or 077–088 and 404–406 (DECA); 094/095/097; 102–105. Not covered (left empty, stated on the page): imports (065/407, 460), private use (455/456, 008–011), triangular operations, OSS/IOSS, distance sales, annual adjustments (098–100), section V of the annual return. The 2026 annual form is not yet published; the 2025 layout is used. |
| A12 | Deduction rights: exempt activities (art. 44), mixed activities (pro-rata), non-registered businesses | Settings: deduction right full / partial (pro-rata %) / none; exemption basis "exempt activity" prints the art. 44 mention; not registered → no deduction, VAT on purchases is part of the cost | Exempt supplies give no right to deduct; mixed activities deduct pro-rata | LTVA art. 44 and following | ✅ | The provisional pro-rata is last year's; the final adjustment is a year-end entry. |
| A13 | Which VAT is deductible | Only Luxembourg VAT (charged by a Luxembourg supplier, or self-assessed) goes to 421611. VAT recorded under another treatment (import, exempt, foreign VAT) is part of the cost. VAT with an unconfirmed treatment is not posted until the user confirms it. A document from a supplier outside Luxembourg that shows VAT is flagged for review. | The Luxembourg return deducts Luxembourg VAT; VAT paid in another EU country is reclaimed from that country | EU VAT refund procedure, Directive 2008/9/EC; LTVA art. 48 (deduction) | ✅ | Before, any VAT amount on a purchase was deducted, including foreign VAT read from a document. |
| A14 | Correcting a posted transaction | One database call updates amounts, rate, treatment and country; a posted transaction is reversed and posted again with the corrected facts | Corrections must stay traceable (no rewriting of posted entries) | Bookkeeping design rule (books kept as in H1) | ✅ | Before, the rate and treatment of a posted transaction were not updated, and editing a reverse-charge purchase failed. |
| A15 | Services bought from a business outside the EU | Same treatment as EU reverse charge ("Service from a business abroad"): VAT self-assessed at the Luxembourg rate and deducted per the deduction right; return boxes 463/464 and 751–956 instead of 436/462. The counterparty country is required. | The customer liable for the tax declares services from suppliers established outside the Community | Official return [TVA_DECM 2026](https://ecdf.b2g.etat.lu/ecdf/formdocs/2026/TVA_DECM/2026M1V002/TVA_DECM_FORMSTATIC_FR_2026M01_2026M1V002.pdf) (II.E.2) | ✅ | Before, such services (for example software subscriptions from the US) were recorded with no VAT and left out of the return. |
| A16 | Import VAT on goods | Not handled: VAT paid on imports is recorded as a cost (treatment "Outside EU / import") and boxes 065/407/460 stay empty | Import VAT is deductible (art. 48/1/c) and declared in II.D / III.A.3 | Official return (as A15) | 🔴 | Gap for businesses importing goods; record with an accountant until supported. |

## B. Corporate direct taxes — Administration des contributions directes (ACD)

| ID | Rule | Zuelen | Official | Source | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | IRC scale from tax year 2025 | ≤ €175,000: 14 %; to €200,001: €24,500 + 30 %; above: 16 % (`src/lib/tax-rules/corporate.ts`) | Same | ACD, [Tarif collectivités](https://impotsdirects.public.lu/fr/az/t/tarif-applicable-collectivites/tarif-collect.html); [Charge fiscale](https://impotsdirects.public.lu/fr/az/c/charg_fisc.html) (19.12.2025) | ✅ | |
| B2 | IRC scale by tax year | 2019–2024: 15 % / €26,250 + 31 % / 17 %; 2025–2026: B1. Later years show "scale not yet published". | Same; a cut for 2027 is announced but not law | as B1; Chamber, QP 62533 (March 2026) | ✅ | Add the 2027 scale when it is voted. |
| B3 | Employment-fund surcharge | 7 % of IRC | 7 % (1.12 points on 16 %) | ACD, Charge fiscale | ✅ | |
| B4 | Municipal business tax | 3 % × communal multiplier on profit − €17,500 | Same | ACD, [Calcul de l'impôt commercial](https://impotsdirects.public.lu/fr/az/c/calc_comm.html) | ✅ | |
| B5 | Minimum net wealth tax | From tax year 2025: €535 / €1,605 / €4,815 by total balance sheet (≤ €350,000 / ≤ €2,000,000 / above); no figure for earlier years | Brackets based only on the balance sheet from 2025 | Loi du 20 décembre 2024 amending the wealth tax law (Mémorial A 563, listed by the [ACD](https://impotsdirects.public.lu/fr/legislation/legi24.html)); brackets from bill 8388 and Andersen's summary (secondary) | 🟡 | Read the consolidated wealth-tax law on Legilux to confirm the brackets. |
| B6 | Taxable profit used for estimates | Revenue − operating expenses (excluding 6711/6721/6811), labelled as an estimate | Taxable income includes adjustments and losses carried forward | LIR | 🟡 | Estimate only, as labelled on the page. |

## C. CCSS — social contributions of independents

Sources: CCSS, [Avis aux non-salariés, taux au 01.01.2026](https://ccss.public.lu/dam-assets/publications/2026/ccss-20260313-avis-60-fr-de.pdf); IGSS, [Paramètres sociaux 01.01.2026](https://igss.gouvernement.lu/dam-assets/publications/param%C3%A8tres-sociaux/2026/par-soc-202601.pdf) and [01.06.2026](https://igss.gouvernement.lu/dam-assets/publications/param%C3%A8tres-sociaux/2026/par-soc-202606.pdf). Values are in `src/lib/ccss/parameters.ts` and `ccss_parameter_periods` (tested to be identical).

| ID | Rule | Zuelen | Official | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| C1 | SSM 1 Jan–31 May 2026 | €2,703.74 | €2,703.74 | ✅ | |
| C2 | SSM from 1 Jun 2026 | €2,771.33 | €2,771.33 | ✅ | |
| C3 | Minimum base, secondary activity (1/3 SSM) | €901.25 / €923.78 | €901.25; June value computed (2,771.33 ÷ 3) | 🟡 | |
| C4 | Maximum base (5 × SSM) | €13,518.68 / €13,856.63 | Same | ✅ | |
| C5 | Assisting spouse maximum (2 × SSM) | €5,407.47 / €5,542.65 | €5,407.47; June not published in the documents read | 🟡 | |
| C6 | Care-insurance deduction, Jan–May 2026 | €675.93 | €675.93 | ✅ | Was €675.94 (fixed in code and production). |
| C7 | Care-insurance deduction from Jun 2026 | €692.83 | €692.83 | ✅ | |
| C8 | Rates | Health 5.60 %, cash 0.50 %, pension 17.00 %, care 1.40 %, accident 0.65 % × factor, MDE 0.23 / 0.95 / 1.56 / 2.66 % | Same | ✅ | |
| C9 | No minimum or maximum for care insurance | Applied | Same | ✅ | |
| C10 | Periods without published parameters | The CCSS page says the official parameters are not yet published instead of extrapolating | — | ✅ | The 2027 minimum wage increase (+3.8 %) is a bill approved by government on 2 Oct 2026, not yet law. Add 2027 values when the IGSS publishes them. |
| C11 | Exemption for insignificant income | Applies on request when income does not exceed 1/3 SSM (was "below") | "ne dépasse pas 1/3 du salaire social minimum", on request | ✅ | [guichet.lu — affiliation de l'indépendant](https://guichet.public.lu/fr/entreprises/creation-developpement/obligations-fiscales-sociales/securite-sociale/affiliation-independant.html); CCSS dispense form. |

## D. Accounting — Plan comptable normalisé (PCN)

| ID | Rule | Zuelen | Official | Source | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | Chart of accounts | PCN 2020 catalogue: 756 accounts, 293 groups, FR/EN labels; seed now in `db/baseline/01_reference_data.sql` | RGD 12 Sept 2019, financial years from 1 Jan 2020; eCDF yearly mapping tables | [guichet.lu — chart of accounts](https://guichet.public.lu/en/entreprises/gestion-juridique-comptabilite/gestion-financiere-comptabilite/enregistrement-comptable/plan-comptable.html); [eCDF mapping](https://ecdf.b2g.etat.lu/ecdf/pcnMappingTables) | 🟡 | Built from the eCDF 2026 standard mapping. A spot-check against the published PCN annex is still recommended. |
| D2 | Accounts used by automatic postings | 4011, 5131, 7033, 6562/7562, 6711/6721/6811, 6132, 61333, 61334, 61348, 6151, 6481, 4712, 42148 | All exist with matching labels | as D1 | ✅ | |
| D3 | Shareholder current account | 4712 | PCN 4712 | as D1 | ✅ | |
| D4 | Default revenue account for service invoices | 7033 | PCN distinguishes 7031/7032/7033 | as D1 | 🟡 | |

## E. Compliance calendar

Deadlines are generated from dated rows in `compliance_rules` (version 2026.2) by `sync_core_compliance_calendar`.

| ID | Rule | Zuelen | Official | Source | Status |
| --- | --- | --- | --- | --- | --- |
| E1 | Approve annual accounts | 6 months after year end | Same | [guichet.lu — filing annual accounts](https://guichet.public.lu/fr/entreprises/gestion-juridique-comptabilite/registre-commerce/depots-publications/depot-comptes-annuels.html) (07.05.2026) | ✅ |
| E2 | File annual accounts | 7 months after year end (outer limit) | Within 1 month of approval | as E1 | ✅ |
| E3 | Who files annual accounts | SARL-S, SARL, SA, SAS, SCA; RCS-registered independents with turnover > €100,000 | Capital companies; partnerships and sole traders > €100,000; others | as E1 | ✅ |
| E4 | Model 500 | 31 December N+1, any financial-year start, from tax year 2022 | Same | ACD, [Délais de dépôt](https://impotsdirects.public.lu/fr/az/d/delais/depot.html) (18.11.2024) | ✅ |
| E5 | VAT deadlines | see A3–A5 | | | ✅ |
| E6 | Independents' income tax | Model 100 by 31 December N+1; quarterly advances on 10 Mar / Jun / Sep / Dec, and business-tax advances 10 Feb / May / Aug / Nov for commercial or craft activities, when the ACD has fixed advances | Same | ACD, [Délais](https://impotsdirects.public.lu/fr/az/d/delais/depot.html), [Calendrier fiscal](https://impotsdirects.public.lu/fr/az/c/calendrierfiscal.html) (26.06.2026) | ✅ |
| E7 | Other recurring obligations | Company IRC advances (10 Mar / Jun / Sep / Dec), ICC and net wealth tax advances (10 Feb / May / Aug / Nov) when fixed by the ACD; CCSS statement payments (from CCSS statements). Not covered: beneficial-owner register (RBE) updates, payroll. | Same | ACD Calendrier fiscal | 🟡 |
| E8 | Single source of truth | The generator reads `compliance_rules`; labels in FR and EN | — | — | ✅ |

## F. Personal tax (independents)

| ID | Rule | Zuelen | Official | Source | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | Tax class (1, 1a, 2) | Married joint → 2; divorced / separated → 2 for 3 years unless used in the prior 5 years; widowed → 2 for 3 years, then 1a; children or age 64 → 1a; non-residents need confirmation | Same (LIR art. 119, no. 3 b and c) | ACD, [Circulaire L.I.R. n° 119/1](https://impotsdirects.public.lu/content/dam/acd/fr/legislation/legi09/Circulaire_L_I_R__n___119-1_du_11_d__cembre_2009.pdf); [guichet.lu — divorce](https://guichet.public.lu/fr/citoyens/fiscalite/declaration-impot-decompte/changement-situation-personelle/divorce.html) | ✅ | Zuelen does not estimate personal income tax. Watch the announced single tax class. |

## G. Invoicing mentions

| ID | Rule | Zuelen | Official | Source | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| G1 | VAT invoice content | Issuer VAT number (when charging VAT), addresses, sequential number at issue, dates, descriptions, quantities, net per rate, rate, VAT amount, exemption / reverse-charge mention | LTVA invoicing list (18 items) | Fiduciaire LPG (secondary, as A8) | 🟡 | Confirm against the LTVA text on Legilux (sources disagree on art. 62 or 63). |
| G2 | R.C.S. number and establishment authorisation on invoices | Printed; warning whenever they are missing (was only above €100, which is the VAT simplified-invoice limit) | Required on invoices, letters, e-mails, quotes and websites | Ministry of the Economy, [Autorisation d'établissement](https://mpc.gouvernement.lu/dam-assets/le-minist%C3%A8re/enforcement/ae-fr.pdf) (05/2025) | ✅ | |
| G3 | Franchise mention | see A7 | | | ✅ | |
| G5 | 2D barcode of the establishment authorisation | Uploaded in Settings; frozen into the issuer snapshot at issue and printed on invoices and the preview; the composer warns when a permit number exists without a barcode | The barcode must appear on invoices, letters, e-mails, quotes, websites and shop fronts | as G2 | ✅ | Letters, e-mails and websites are outside Zuelen. |

## H. Bookkeeping law

| ID | Rule | Zuelen | Official | Source | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| H1 | Keep books and supporting documents | Resets refuse closed periods, filed declarations, issued invoices and posted entries of ended financial years | 10 years from the end of the financial year (Code de commerce art. 16) | Consolidated Code de commerce (secondary copy); Legilux to confirm | ✅ | Migration 20261009120000. |

---

## Open decisions and next steps

1. **Import VAT (A16)** and **VAT on fixed-asset purchases** (asset accounts cannot carry VAT in the posting workflow yet): Phase 1 journal audit.
2. **Annual accounts output:** the official filing is a structured eCDF file (balance sheet, P&L and, under a June 2025 draft regulation, PCN balances). Add its format and the abridged / full thresholds to this register before offering "annual accounts" as filing-ready.
3. Add the 2027 IRC scale and the 2027 CCSS parameters when they are published.
