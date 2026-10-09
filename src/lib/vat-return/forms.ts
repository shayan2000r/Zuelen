// Official Luxembourg VAT return forms (eCDF), box numbers and labels as printed on the AED forms.
// See docs/compliance/REGULATORY_REGISTER.md (A11).
//
// Monthly and quarterly returns (TVA_DECM / TVA_DECT) share the same boxes; the annual return (TVA_DECA)
// splits turnover by business branch (001–007) and input VAT by type of expense (077–088, 404–406).

export type VatReturnForm = "DECM" | "DECT" | "DECA";

export const VAT_FORM_SOURCES: Record<VatReturnForm, { version: string; url: string; urlEn: string }> = {
  DECM: {
    version: "2026M1V002",
    url: "https://ecdf.b2g.etat.lu/ecdf/formdocs/2026/TVA_DECM/2026M1V002/TVA_DECM_FORMSTATIC_FR_2026M01_2026M1V002.pdf",
    urlEn:
      "https://ecdf.b2g.etat.lu/ecdf/formdocs/2026/TVA_DECM/2026M1V002/TVA_DECM_FORMSTATIC_EN_2026M01_2026M1V002.pdf",
  },
  DECT: {
    version: "2026M1V002",
    url: "https://ecdf.b2g.etat.lu/ecdf/formdocs/2026/TVA_DECT/2026M1V002/TVA_DECT_FORMSTATIC_FR_2026Q01_2026M1V002.pdf",
    urlEn:
      "https://ecdf.b2g.etat.lu/ecdf/formdocs/2026/TVA_DECT/2026M1V002/TVA_DECT_FORMSTATIC_EN_2026Q01_2026M1V002.pdf",
  },
  DECA: {
    version: "2025M1V002",
    url: "https://ecdf.b2g.etat.lu/ecdf/formdocs/2025/TVA_DECA/2025M1V002/TVA_DECA_FORMSTATIC_FR_2025_2025M1V002.pdf",
    urlEn: "https://ecdf.b2g.etat.lu/ecdf/formdocs/2025/TVA_DECA/2025M1V002/TVA_DECA_FORMSTATIC_EN_2025_2025M1V002.pdf",
  },
};

type Label = { fr: string; en: string };
export type VatFormLine =
  | { kind: "amount"; box: string; label: Label; depth: number; total?: boolean }
  | { kind: "pair"; base: string; tax: string; label: Label; depth: number; total?: boolean };
export type VatFormSection = { title: Label; lines: VatFormLine[] };

const a = (box: string, fr: string, en: string, depth = 1, total = false): VatFormLine => ({
  kind: "amount",
  box,
  label: { fr, en },
  depth,
  total,
});
const p = (base: string, tax: string, fr: string, en: string, depth = 1, total = false): VatFormLine => ({
  kind: "pair",
  base,
  tax,
  label: { fr, en },
  depth,
  total,
});

/** Rate lines and their (base, tax) boxes, by section. Identical on the monthly, quarterly and annual forms. */
export const RATE_BOXES = {
  sales: {
    17: ["701", "702"],
    16: ["901", "902"],
    14: ["703", "704"],
    13: ["903", "904"],
    8: ["705", "706"],
    7: ["905", "906"],
    3: ["031", "040"],
  },
  intraCommunityAcquisitions: {
    17: ["711", "712"],
    16: ["911", "912"],
    14: ["713", "714"],
    13: ["913", "914"],
    8: ["715", "716"],
    7: ["915", "916"],
    3: ["049", "054"],
  },
  servicesFromEu: {
    17: ["741", "742"],
    16: ["941", "942"],
    14: ["743", "744"],
    13: ["943", "944"],
    8: ["745", "746"],
    7: ["945", "946"],
    3: ["431", "432"],
  },
  servicesFromOutsideEu: {
    17: ["751", "752"],
    16: ["951", "952"],
    14: ["753", "754"],
    13: ["953", "954"],
    8: ["755", "756"],
    7: ["955", "956"],
    3: ["441", "442"],
  },
} as const satisfies Record<string, Record<number, readonly [string, string]>>;

function rateLines(table: Record<number, readonly [string, string]>, depth: number): VatFormLine[] {
  return Object.entries(table)
    .sort(([x], [y]) => Number(y) - Number(x))
    .map(([rate, [base, tax]]) => p(base, tax, `au taux de ${rate} %`, `rate of ${rate} %`, depth));
}

const turnoverExemptions = (form: VatReturnForm): VatFormLine[] => [
  a("021", "B. Exonérations et montants déductibles", "B. Exemptions and deductible amounts", 0, true),
  form === "DECA"
    ? a(
        "013",
        "Livraisons intracommunautaires de biens (art. 43/1/d et f)",
        "Intra-Community supply of goods (Art. 43(1)(d) and (f))",
      )
    : a(
        "457",
        "Livraisons intracommunautaires de biens (art. 43/1/d, e et f)",
        "Intra-Community supply of goods (Art. 43(1)(d), (e) and (f))",
      ),
  a("014", "Livraisons à l'exportation (art. 43/1/a et b)", "Exports (Art. 43(1)(a) and (b))"),
  a("015", "Autres exonérations (art. 43 et 60bis)", "Other exemptions (Art. 43 and 60bis)"),
  a("016", "Autres exonérations (art. 44 et 56quater)", "Other exemptions (Art. 44 and 56quater)"),
  a("481", "Régime de franchise national de l'article 57bis", "Domestic SME scheme of article 57bis"),
  a(
    "423",
    "Prestations de services à des identifiés à la TVA dans un autre État membre, non exonérées dans l'État membre du preneur redevable (art. 17/1/b)",
    "Services to customers identified for VAT in another MS, not exempt in the MS where the customer is liable (Art. 17(1)(b))",
  ),
  a(
    "019",
    "Autres opérations réalisées (imposables) à l'étranger",
    "Other supplies carried out (for which the place of supply is) abroad",
  ),
  a("022", "C. Chiffre d'affaires imposable (012-021)", "C. Taxable turnover (012-021)", 0, true),
];

const outputTax: VatFormSection = {
  title: { fr: "II. Calcul de la taxe due (taxe en aval)", en: "II. Assessment of tax due (output tax)" },
  lines: [
    p("037", "046", "A. Ventilation du chiffre d'affaires imposable", "A. Breakdown of taxable turnover", 0, true),
    ...rateLines(RATE_BOXES.sales, 1),
    p(
      "051",
      "056",
      "B. Acquisitions intracommunautaires de biens",
      "B. Intra-Community acquisitions of goods",
      0,
      true,
    ),
    ...rateLines(RATE_BOXES.intraCommunityAcquisitions, 1),
    p(
      "409",
      "410",
      "E. Prestations de services à déclarer par le preneur redevable de la taxe",
      "E. Supply of services for which the customer is liable for the payment of VAT",
      0,
      true,
    ),
    p(
      "436",
      "462",
      "1. a) effectuées par des assujettis établis dans un autre État membre, non exonérées à l'intérieur du pays",
      "1. a) provided by suppliers established in another MS, not exempt within the territory",
      1,
    ),
    ...rateLines(RATE_BOXES.servicesFromEu, 2),
    p(
      "463",
      "464",
      "2. effectuées par des assujettis établis en dehors de la Communauté",
      "2. provided by suppliers not established within the Community",
      1,
    ),
    ...rateLines(RATE_BOXES.servicesFromOutsideEu, 2),
    a(
      "076",
      "H. Total de la taxe en aval (046+056+407+410+768+227)",
      "H. Total tax due (046+056+407+410+768+227)",
      0,
      true,
    ),
  ],
};

const balance: VatFormSection = {
  title: { fr: "IV. Calcul de l'excédent", en: "IV. Tax to be paid or to be reclaimed" },
  lines: [
    a("103", "A. Total de la taxe en aval", "A. Total tax due", 0),
    a("104", "B. Total de la taxe en amont déductible", "B. Total input tax deductible", 0),
    a(
      "105",
      "C. Excédent (un excédent de taxe en amont est marqué d'un signe négatif) (103-104)",
      "C. Exceeding amount (a surplus of deductible tax is preceded by a minus sign) (103-104)",
      0,
      true,
    ),
  ],
};

const periodicReturn = (form: "DECM" | "DECT"): VatFormSection[] => [
  {
    title: { fr: "I. Calcul du chiffre d'affaires imposable", en: "I. Assessment of taxable turnover" },
    lines: [
      a("012", "A. Chiffre d'affaires global", "A. Overall turnover", 0, true),
      a("454", "1. Total des ventes / recettes", "1. Total sales / receipts"),
      a("472", "b) Autres ventes / recettes", "b) Other sales / receipts", 2),
      ...turnoverExemptions(form),
    ],
  },
  outputTax,
  {
    title: {
      fr: "III. Calcul de la taxe déductible (taxe en amont)",
      en: "III. Assessment of deductible tax (input tax)",
    },
    lines: [
      a("093", "A. Total de la taxe en amont", "A. Total input tax", 0, true),
      a(
        "458",
        "1. Achats de biens et de services à l'intérieur du pays (art. 48/1/a)",
        "1. Invoiced by other taxable persons for goods or services supplied (Art. 48(1)(a))",
      ),
      a(
        "459",
        "2. Acquisitions intracommunautaires de biens (art. 48/1/b)",
        "2. Due in respect of intra-Community acquisitions of goods (Art. 48(1)(b))",
      ),
      a(
        "461",
        "5. Taxe déclarée comme débiteur (points II.E et F)",
        "5. Due under the reverse charge (points II.E and F)",
      ),
      a("097", "B. Total de la taxe en amont non déductible", "B. Total input tax non-deductible", 0, true),
      a(
        "094",
        "1. en rapport avec des opérations exonérées (art. 44, 56quater, 57bis, 57ter et 57quater)",
        "1. relating to transactions exempt under Art. 44, 56quater, 57bis, 57ter and 57quater",
      ),
      a(
        "095",
        "2. en application du prorata visé à l'article 50",
        "2. where the deductible proportion of article 50 is applied",
      ),
      a("102", "C. Total de la taxe en amont déductible (093-097)", "C. Total input tax deductible (093-097)", 0, true),
    ],
  },
  balance,
];

const annualReturn: VatFormSection[] = [
  {
    title: { fr: "I. Calcul du chiffre d'affaires imposable", en: "I. Assessment of taxable turnover" },
    lines: [
      a("012", "A. Chiffre d'affaires global", "A. Overall turnover", 0, true),
      a("001", "Ventes de produits fabriqués dans l'entreprise", "Supply of inhouse manufactured goods", 2),
      a("002", "Ventes de marchandises revendues en l'état", "Supply of goods not manufactured inhouse", 2),
      a("004", "b) Prestations de services", "b) Supply of services"),
      a("007", "e) Autres (à préciser en case 206)", "e) Other (describe in box 206)"),
      ...turnoverExemptions("DECA"),
    ],
  },
  outputTax,
  {
    title: {
      fr: "III. Calcul de la taxe déductible (taxe en amont)",
      en: "III. Assessment of deductible tax (input tax)",
    },
    lines: [
      a("093", "A. Total de la taxe en amont", "A. Total input tax", 0, true),
      a("080", "1. Total taxe en amont sur entrées de marchandises", "1. Total of VAT on stock entries", 1, true),
      a("077", "a) Taxe facturée par d'autres assujettis", "a) VAT invoiced by other taxable persons", 2),
      a("078", "b) Acquisitions intracommunautaires de biens", "b) Intra-Community acquisitions of goods", 2),
      a("404", "d) Taxe déclarée comme débiteur", "d) VAT due under the reverse charge", 2),
      a(
        "084",
        "2. Total taxe en amont sur acquisitions d'immobilisations",
        "2. Total of VAT on capital expenditures",
        1,
        true,
      ),
      a("081", "a) Taxe facturée par d'autres assujettis", "a) VAT invoiced by other taxable persons", 2),
      a("082", "b) Acquisitions intracommunautaires de biens", "b) Intra-Community acquisitions of goods", 2),
      a("405", "d) Taxe déclarée comme débiteur", "d) VAT due under the reverse charge", 2),
      a("088", "3. Total taxe en amont sur frais généraux", "3. Total of VAT on operational expenditures", 1, true),
      a("085", "a) Taxe facturée par d'autres assujettis", "a) VAT invoiced by other taxable persons", 2),
      a("086", "b) Acquisitions intracommunautaires de biens", "b) Intra-Community acquisitions of goods", 2),
      a("406", "d) Taxe déclarée comme débiteur", "d) VAT due under the reverse charge", 2),
      a("097", "B. Total de la taxe en amont non déductible", "B. Total input tax non-deductible", 0, true),
      a(
        "094",
        "1. en rapport avec des opérations exonérées (art. 44, 56quater, 57bis, 57ter et 57quater)",
        "1. relating to supplies exempt under Art. 44, 56quater, 57bis, 57ter and 57quater",
      ),
      a(
        "095",
        "2. en application du prorata visé à l'article 50",
        "2. proportion determined in accordance with Art. 50",
      ),
      a("101", "C. Régularisation des déductions", "C. Adjustment of deductions", 0, true),
      a(
        "102",
        "D. Total de la taxe en amont déductible (093-097+101)",
        "D. Total input tax deductible (093-097+101)",
        0,
        true,
      ),
    ],
  },
  balance,
];

export function vatFormLayout(form: VatReturnForm): VatFormSection[] {
  return form === "DECA" ? annualReturn : periodicReturn(form);
}
