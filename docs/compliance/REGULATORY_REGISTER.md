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
| ⏳ Fixed, pending approval | Fix written and tested; part of `db/pending/requires_approval.sql`, waiting for a person to approve it in Supabase |
| ⚠️ Mismatch | Zuelen differs from the official source |
| ❌ Missing | The rule applies to Zuelen's users but is not implemented |
| 🟡 Partial | Implemented, but simplified or only confirmed through secondary sources |
| 🔍 Source needed | Implemented, official source not yet located |

### Summary

| Area | ✅ | ⏳ | ⚠️ | ❌ | 🟡 | 🔍 |
| --- | --- | --- | --- | --- | --- | --- |
| A. VAT (TVA) | 9 | 1 | 0 | 0 | 2 | 0 |
| B. Corporate direct taxes | 4 | 0 | 0 | 0 | 2 | 0 |
| C. CCSS (independents) | 9 | 0 | 0 | 0 | 2 | 0 |
| D. Accounting (PCN) | 2 | 0 | 0 | 0 | 2 | 0 |
| E. Compliance calendar | 7 | 0 | 0 | 0 | 1 | 0 |
| F. Personal tax (independents) | 1 | 0 | 0 | 0 | 0 | 0 |
| G. Invoicing mentions | 2 | 0 | 0 | 1 | 1 | 0 |
| H. Bookkeeping law | 0 | 1 | 0 | 0 | 0 | 0 |

Before the fixes: 19 ✅, 6 ⚠️, 5 ❌, 8 🟡, 5 🔍.

---

## A. VAT (TVA) — Administration de l'enregistrement, des domaines et de la TVA (AED)

Legal basis: loi modifiée du 12 février 1979 concernant la taxe sur la valeur ajoutée (LTVA).

| ID | Rule | Zuelen | Official | Source | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | VAT rates by date of supply | `vat_rate_periods` (DB) and `src/lib/tax-rules/vat.ts`: 17/14/8/3 % (2015–2022, from 2024), 16/13/7/3 % (2023), 0 %. Rate pickers follow the transaction / service date; DB validates by date. | Same | European Commission, [VAT rates from 1 January 2024](https://trade.ec.europa.eu/access-to-markets/fr/news/modifications-des-taux-de-tva-applicables-au-1-janvier-2024-dans-certains-etats-membres-de-lue); LTVA art. 39–40 | ⏳ | Correct rates are enforced now. Entering a 2023 rate also needs the removal of the old 0/3/8/14/17 checks in `db/pending`. |
| A2 | Filing frequency thresholds | annual < €112,000; quarterly to €620,000; monthly above (settings map the turnover bracket; the AED assignment prevails) | Same | [guichet.lu — VAT return](https://guichet.public.lu/fr/entreprises/fiscalite/impots-benefices/tva/declarations/declaration-tva.html) (20.01.2023) | ✅ | |
| A3 | Monthly / quarterly return | Due date shown: 14th of the following month / quarter | "avant le 15e jour du mois (trimestre) qui suit" | as A2 | ✅ | Shown as the last day that complies with "before". |
| A4 | Annual return | Last day of February (annual filers); 30 April (monthly / quarterly filers) | "avant le 1er mars" / "avant le 1er mai" | as A2 | ✅ | Was 1 March / 1 May. Existing open deadlines were moved. |
| A5 | EU recapitulative statement | One obligation per month (or quarter, if chosen in settings) with an EU B2B supply; due the 24th of the following month | "avant le 25e jour du mois qui suit la période déclarative"; monthly by default, quarterly allowed for services and for goods ≤ €50,000/quarter | [guichet.lu — recapitulative statements](https://guichet.public.lu/fr/entreprises/fiscalite/impots-benefices/tva/declarations/etats-recapitulatifs.html) (19.01.2023) | ✅ | |
| A6 | Small-business franchise | Settings: "supplies without VAT → franchise"; tax pages show turnover against €50,000 (+10 % tolerance) and what happens when exceeded | €50,000 from 1 Jan 2025 (10 % tolerance in the year of exceeding, excluded the next year; above €55,000 it ends the next day); €35,000 before 2025; EU limit €100,000 | AED, [FAQ régime de franchise](https://pfi.public.lu/dam-assets/pdf/tva/sme/faq-fr.pdf) | ✅ | Turnover = class 70 revenue posted in the calendar year. |
| A7 | Franchise invoice mention | Stored on the invoice at issue and printed: "TVA non applicable – Article 57bis de la loi modifiée du 12 février 1979" | Same wording | AED FAQ (as A6) | ✅ | Applies when the business is under the franchise or not VAT registered. |
| A8 | Reverse-charge mention (EU B2B) | "Autoliquidation" stored at issue; customer VAT number required; not allowed for LU customers | "Autoliquidation" / "Reverse charge" when the customer is liable for the VAT | Fiduciaire LPG, [VAT compulsory information on invoices](https://www.fiduciaire-lpg.lu/en/publications/vat/vat-compulsory-information-invoices) (secondary) | 🟡 | Wording confirmed through a secondary source. Customer VAT numbers are not checked against VIES. |
| A9 | Reverse charge on EU B2B purchases | Output VAT self-assessed in full (461411); input VAT deducted according to the company's deduction right; any non-deductible part is added to the cost | Same mechanism | LTVA | ✅ | Tested: pro-rata 60 % on €170 VAT gives €102 deducted, €68 added to the expense. |
| A10 | VAT ledger accounts | 421611 "TVA en amont", 461411 "TVA en aval" | In PCN 2020 | eCDF PCN mapping | ✅ | |
| A11 | VAT return content | Output, input and net VAT totals (`LU-VAT-2026.1`), flagged "manual review required" | Official forms (eCDF `TVA_DECM` / `TVA_DECT` / `TVA_DECA`) have many boxes | eCDF specifications (to collect) | 🟡 | **Open decision**: produce the official box layout, or keep totals plus guidance for launch. |
| A12 | Deduction rights: exempt activities (art. 44), mixed activities (pro-rata), non-registered businesses | Settings: deduction right full / partial (pro-rata %) / none; exemption basis "exempt activity" prints the art. 44 mention; not registered → no deduction, VAT on purchases is part of the cost | Exempt supplies give no right to deduct; mixed activities deduct pro-rata | LTVA art. 44 and following | ✅ | The provisional pro-rata is last year's; the final adjustment is a year-end entry. |

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
| G5 | 2D barcode of the establishment authorisation | Not supported | The barcode must appear on invoices, letters, e-mails, quotes, websites and shop fronts | as G2 | ❌ | New finding. Needs an upload of the barcode issued by the Ministry and printing it on invoices. |

## H. Bookkeeping law

| ID | Rule | Zuelen | Official | Source | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| H1 | Keep books and supporting documents | Resets refuse closed periods, filed declarations, issued invoices and posted entries of ended financial years | 10 years from the end of the financial year (Code de commerce art. 16) | Consolidated Code de commerce (secondary copy); Legilux to confirm | ⏳ | Guard written and tested in `db/pending/requires_approval.sql`. |

---

## Open decisions and next steps

1. **Approve `db/pending/requires_approval.sql`** in Supabase (retention guard, 2023 rates, draft validation, cleanup).
2. **VAT return layout (A11):** decide whether Zuelen should produce the official eCDF boxes for launch.
3. **Establishment-authorisation barcode (G5):** add an upload and print it on invoices.
4. **Annual accounts output:** the official filing is a structured eCDF file (balance sheet, P&L and, under a June 2025 draft regulation, PCN balances). Add its format and the abridged / full thresholds to this register before offering "annual accounts" as filing-ready.
5. Add the 2027 IRC scale and the 2027 CCSS parameters when they are published.
