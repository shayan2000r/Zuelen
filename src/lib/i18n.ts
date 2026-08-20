export type Locale = "en" | "fr";

export type AccountTranslation = {
  code: string;
  label: string;
  label_en: string | null;
  label_fr: string | null;
};

export const DEFAULT_LOCALE: Locale = "en";
export const SUPPORTED_LOCALES: readonly Locale[] = ["en", "fr"] as const;

export function normalizeLocale(value: unknown): Locale {
  return value === "fr" ? "fr" : "en";
}

export function intlLocale(locale: Locale) {
  return locale === "fr" ? "fr-LU" : "en-LU";
}

const messages = {
  en: {
    overview: "Overview",
    transactions: "Transactions",
    banking: "Banking",
    invoices: "Invoices",
    documents: "Documents",
    accountingTax: "Accounting & tax",
    accounting: "Accounting",
    vatFiling: "VAT filing",
    taxes: "Taxes",
    yearEnd: "Year-end",
    annualAccounts: "Annual accounts",
    compliance: "Compliance",
    insightsAi: "Insights & AI",
    reports: "Reports",
    copilot: "Copilot",
    settings: "Settings",
    financialYear: "Financial year",
    appearance: "Appearance",
    language: "Language",
    english: "English",
    french: "French",
    myProfile: "My Profile",
    signOut: "Sign out",
    notifications: "Notifications",
    complianceCenter: "Compliance center",
    searchCompta: "Search Compta",
    searchPlaceholder: "Search pages and workspaces…",
    results: "Results",
    quickNavigation: "Quick navigation",
    noMatchingWorkspace: "No matching workspace found.",
    closeNavigation: "Close navigation",
    openNavigation: "Open navigation",
    closeNotifications: "Close notifications",
    lightMode: "Use light mode",
    darkMode: "Use dark mode",
    companySnapshot: "Company snapshot",
    reviewPostActivity: "Review and post activity",
    statementsReconciliation: "Statements and reconciliation",
    salesReceivables: "Sales and receivables",
    companyDocumentVault: "Company document vault",
    doubleEntryJournal: "Double-entry journal",
    vatReadiness: "VAT readiness",
    estimatesReservesNotices: "Estimates, reserves & notices",
    closingChecklist: "Closing checklist",
    ecdfPreparation: "eCDF preparation",
    deadlinesObligations: "Deadlines and obligations",
    financialAnalyticsStatements: "Financial analytics & statements",
    askYourBooks: "Ask your books",
    companyProfilePreferences: "Company profile & preferences",
    member: "Member",
    owner: "Owner",
    admin: "Admin",
    accountant: "Accountant",
    bookkeeper: "Bookkeeper",
    viewer: "Viewer",
    viewReports: "View reports",
    revenue: "Revenue",
    expenses: "Expenses",
    vatPosition: "VAT position",
    estimatedTaxes: "Estimated taxes",
    netResult: "Net result",
    margin: "Margin",
    revenueExpenses: "Revenue & expenses",
    yourBooksExplained: "Your books, explained simply.",
    openCopilot: "Open Copilot",
    recentActivity: "Recent activity",
    latestTransactions: "Latest transactions",
    viewAll: "View all",
    noTransactions: "No transactions in the selected financial year yet.",
    posted: "Posted",
    needsReview: "Needs review",
    income: "Income",
    expense: "Expense",
    personalSettings: "Personal settings",
    profilePhoto: "Profile photo",
    personalIdentity: "Personal identity",
    yourDetails: "Your details",
    fullName: "Full name",
    emailAddress: "Email address",
    saveProfile: "Save profile",
    saving: "Saving…",
  },
  fr: {
    overview: "Vue d’ensemble",
    transactions: "Transactions",
    banking: "Banque",
    invoices: "Factures",
    documents: "Documents",
    accountingTax: "Comptabilité et fiscalité",
    accounting: "Comptabilité",
    vatFiling: "Déclarations TVA",
    taxes: "Impôts",
    yearEnd: "Clôture annuelle",
    annualAccounts: "Comptes annuels",
    compliance: "Obligations",
    insightsAi: "Analyses et IA",
    reports: "Rapports",
    copilot: "Copilot",
    settings: "Paramètres",
    financialYear: "Exercice",
    appearance: "Apparence",
    language: "Langue",
    english: "Anglais",
    french: "Français",
    myProfile: "Mon profil",
    signOut: "Se déconnecter",
    notifications: "Notifications",
    complianceCenter: "Centre des obligations",
    searchCompta: "Rechercher dans Compta",
    searchPlaceholder: "Rechercher des pages et espaces…",
    results: "Résultats",
    quickNavigation: "Navigation rapide",
    noMatchingWorkspace: "Aucun espace correspondant.",
    closeNavigation: "Fermer la navigation",
    openNavigation: "Ouvrir la navigation",
    closeNotifications: "Fermer les notifications",
    lightMode: "Utiliser le mode clair",
    darkMode: "Utiliser le mode sombre",
    companySnapshot: "Vue synthétique de l’entreprise",
    reviewPostActivity: "Vérifier et comptabiliser l’activité",
    statementsReconciliation: "Relevés et rapprochement",
    salesReceivables: "Ventes et créances clients",
    companyDocumentVault: "Espace documentaire de l’entreprise",
    doubleEntryJournal: "Journal en partie double",
    vatReadiness: "Préparation TVA",
    estimatesReservesNotices: "Estimations, réserves et avis",
    closingChecklist: "Liste de contrôle de clôture",
    ecdfPreparation: "Préparation eCDF",
    deadlinesObligations: "Échéances et obligations",
    financialAnalyticsStatements: "Analyses et états financiers",
    askYourBooks: "Interroger votre comptabilité",
    companyProfilePreferences: "Profil de l’entreprise et préférences",
    member: "Membre",
    owner: "Propriétaire",
    admin: "Administrateur",
    accountant: "Comptable",
    bookkeeper: "Aide-comptable",
    viewer: "Lecteur",
    viewReports: "Voir les rapports",
    revenue: "Produits",
    expenses: "Charges",
    vatPosition: "Position TVA",
    estimatedTaxes: "Impôts estimés",
    netResult: "Résultat net",
    margin: "Marge",
    revenueExpenses: "Produits et charges",
    yourBooksExplained: "Votre comptabilité, expliquée simplement.",
    openCopilot: "Ouvrir Copilot",
    recentActivity: "Activité récente",
    latestTransactions: "Dernières transactions",
    viewAll: "Tout voir",
    noTransactions: "Aucune transaction pour l’exercice sélectionné.",
    posted: "Comptabilisée",
    needsReview: "À vérifier",
    income: "Recette",
    expense: "Dépense",
    personalSettings: "Paramètres personnels",
    profilePhoto: "Photo de profil",
    personalIdentity: "Identité personnelle",
    yourDetails: "Vos informations",
    fullName: "Nom complet",
    emailAddress: "Adresse e-mail",
    saveProfile: "Enregistrer le profil",
    saving: "Enregistrement…",
  },
} as const;

export type MessageKey = keyof typeof messages.en;

export function t(locale: Locale, key: MessageKey): string {
  return messages[locale][key] ?? messages.en[key];
}

export function localizedRole(locale: Locale, role: string | null | undefined) {
  if (!role) return t(locale, "member");
  const key = role as MessageKey;
  return key in messages.en ? t(locale, key) : role;
}

export function localizedAccountLabel(locale: Locale, account: Pick<AccountTranslation, "label" | "label_en" | "label_fr">) {
  if (locale === "fr") return account.label_fr || account.label_en || account.label;
  return account.label_en || account.label;
}

export function buildAccountTextMap(locale: Locale, accounts: AccountTranslation[]) {
  const map: Record<string, string> = {};
  for (const account of accounts) {
    const target = localizedAccountLabel(locale, account);
    for (const source of [account.label, account.label_en, account.label_fr]) {
      if (source && source !== target) map[source] = target;
    }
  }
  return map;
}

const legacyFr: Record<string, string> = {
  "All Documents": "Tous les documents",
  "All documents": "Tous les documents",
  "Bank Statements": "Relevés bancaires",
  "Financial Reports": "Rapports financiers",
  "Create": "Créer",
  "Upload document": "Importer un document",
  "Generate financial document": "Générer un document financier",
  "Choose what you want to create": "Choisissez ce que vous souhaitez créer",
  "Upload a source document": "Importer un document source",
  "Generate from closed books": "Générer à partir d’un exercice clôturé",
  "Document type": "Type de document",
  "Select report": "Sélectionner un rapport",
  "Generate": "Générer",
  "Delete": "Supprimer",
  "View": "Voir",
  "Download": "Télécharger",
  "Ready": "Disponible",
  "No documents yet": "Aucun document pour le moment",
  "No generated reports yet": "Aucun rapport généré pour le moment",
  "New transaction": "Nouvelle transaction",
  "Add transaction": "Ajouter une transaction",
  "Transaction": "Transaction",
  "Transactions": "Transactions",
  "Date": "Date",
  "Description": "Description",
  "Counterparty": "Contrepartie",
  "Amount": "Montant",
  "Status": "Statut",
  "Category": "Catégorie",
  "Account": "Compte",
  "Accounts": "Comptes",
  "Debit": "Débit",
  "Credit": "Crédit",
  "Balance": "Solde",
  "Opening balance": "Solde d’ouverture",
  "Closing balance": "Solde de clôture",
  "General Ledger": "Grand livre",
  "General Journal": "Journal général",
  "Trial Balance": "Balance générale",
  "Profit & Loss": "Compte de profits et pertes",
  "Balance Sheet": "Bilan",
  "PCN Closing Balances": "Soldes de clôture PCN",
  "Annual Accounts": "Comptes annuels",
  "Annexe to the Annual Accounts": "Annexe aux comptes annuels",
  "Annexe to the Annual Accounts - Draft": "Annexe aux comptes annuels - Projet",
  "Revenue": "Produits",
  "Expenses": "Charges",
  "Result": "Résultat",
  "Result for the year": "Résultat de l’exercice",
  "Total revenue": "Total des produits",
  "Total expenses": "Total des charges",
  "Total assets": "Total de l’actif",
  "Assets": "Actif",
  "Equity and liabilities": "Capitaux propres et passif",
  "Total equity and liabilities": "Total des capitaux propres et du passif",
  "Balance control": "Contrôle du bilan",
  "Closing debit total": "Total des soldes débiteurs",
  "Closing credit total": "Total des soldes créditeurs",
  "Control difference": "Écart de contrôle",
  "Company identification": "Identification de l’entreprise",
  "Legal name": "Dénomination légale",
  "Legal form": "Forme juridique",
  "RCS number": "Numéro RCS",
  "Registered address": "Siège social",
  "Financial overview": "Aperçu financier",
  "Closing position": "Situation de clôture",
  "Review before official use": "Vérification avant utilisation officielle",
  "VAT": "TVA",
  "VAT filing": "Déclarations TVA",
  "VAT position": "Position TVA",
  "VAT reserve": "Réserve TVA",
  "Taxes": "Impôts",
  "Estimated taxes": "Impôts estimés",
  "Tax reserve": "Réserve fiscale",
  "Accounting": "Comptabilité",
  "Year-end": "Clôture annuelle",
  "Annual accounts": "Comptes annuels",
  "Compliance": "Obligations",
  "Reports": "Rapports",
  "Settings": "Paramètres",
  "Team & Access": "Équipe et accès",
  "My Profile": "Mon profil",
  "Company profile": "Profil de l’entreprise",
  "Business profile": "Profil de l’entreprise",
  "Personal settings": "Paramètres personnels",
  "Personal identity": "Identité personnelle",
  "Profile photo": "Photo de profil",
  "Your details": "Vos informations",
  "Full name": "Nom complet",
  "Email address": "Adresse e-mail",
  "Upload image": "Importer une image",
  "Remove": "Supprimer",
  "Save profile": "Enregistrer le profil",
  "Save changes": "Enregistrer les modifications",
  "Saving…": "Enregistrement…",
  "Invite member": "Inviter un membre",
  "Invite by email": "Inviter par e-mail",
  "Pending invitations": "Invitations en attente",
  "Current members": "Membres actuels",
  "Role": "Rôle",
  "Owner": "Propriétaire",
  "Admin": "Administrateur",
  "Accountant": "Comptable",
  "Bookkeeper": "Aide-comptable",
  "Viewer": "Lecteur",
  "Read only": "Lecture seule",
  "Read-only": "Lecture seule",
  "Invoices": "Factures",
  "New invoice": "Nouvelle facture",
  "Invoice": "Facture",
  "Customer": "Client",
  "Issue date": "Date d’émission",
  "Due date": "Date d’échéance",
  "Draft": "Brouillon",
  "Issued": "Émise",
  "Paid": "Payée",
  "Overdue": "En retard",
  "Total": "Total",
  "Subtotal": "Sous-total",
  "Notes": "Notes",
  "Banking": "Banque",
  "Import statement": "Importer un relevé",
  "Import bank statement": "Importer un relevé bancaire",
  "Bank movements": "Mouvements bancaires",
  "Reconciliation": "Rapprochement",
  "Reconciled": "Rapproché",
  "Possible duplicate": "Doublon possible",
  "Import history": "Historique des imports",
  "Overview": "Vue d’ensemble",
  "Recent activity": "Activité récente",
  "Latest transactions": "Dernières transactions",
  "View all": "Tout voir",
  "Net result": "Résultat net",
  "Margin": "Marge",
  "Compta Copilot": "Compta Copilot",
  "Open Copilot": "Ouvrir Copilot",
  "Notifications": "Notifications",
  "Quick navigation": "Navigation rapide",
  "Results": "Résultats",
  "Appearance": "Apparence",
  "Language": "Langue",
  "Financial year": "Exercice",
  "Posted": "Comptabilisée",
  "Needs review": "À vérifier",
  "Unclassified": "Non classée",
  "Review": "À vérifier",
  "Income": "Recette",
  "Expense": "Dépense",
  "Currency": "Devise",
  "Source": "Source",
  "Actions": "Actions",
  "Search": "Rechercher",
  "Filter": "Filtrer",
  "Clear": "Effacer",
  "Cancel": "Annuler",
  "Close": "Fermer",
  "Edit": "Modifier",
  "Confirm": "Confirmer",
  "Continue": "Continuer",
  "Back": "Retour",
  "Next": "Suivant",
  "Done": "Terminé",
};

export function translateLegacyText(locale: Locale, value: string, accountTextMap: Record<string, string> = {}) {
  if (locale === "en" || !value) return value;
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const core = value.trim();
  if (!core) return value;
  const exact = accountTextMap[core] || legacyFr[core];
  if (exact) return `${leading}${exact}${trailing}`;

  let match = core.match(/^Financial year (\d{4})$/i);
  if (match) return `${leading}Exercice ${match[1]}${trailing}`;
  match = core.match(/^(\d{4}) financial year$/i);
  if (match) return `${leading}Exercice ${match[1]}${trailing}`;
  match = core.match(/^(\d+) transactions? need review$/i);
  if (match) return `${leading}${match[1]} transaction${Number(match[1]) > 1 ? "s" : ""} à vérifier${trailing}`;
  match = core.match(/^Open transaction review for (\d{4})$/i);
  if (match) return `${leading}Ouvrir la vérification des transactions pour ${match[1]}${trailing}`;
  match = core.match(/^You[’']re all caught up for (\d{4})\.$/i);
  if (match) return `${leading}Tout est à jour pour ${match[1]}.${trailing}`;
  match = core.match(/^Review (\d{4}) obligations$/i);
  if (match) return `${leading}Vérifier les obligations ${match[1]}${trailing}`;
  match = core.match(/^Role:\s*(.+)$/i);
  if (match) return `${leading}Rôle : ${localizedRole(locale, match[1].toLowerCase())}${trailing}`;
  match = core.match(/^Generated (.+)$/i);
  if (match) return `${leading}Généré le ${match[1]}${trailing}`;
  return value;
}

export const financialDocumentNames: Record<string, { en: string; fr: string }> = {
  profit_loss: { en: "Profit & Loss", fr: "Compte de profits et pertes" },
  balance_sheet: { en: "Balance Sheet", fr: "Bilan" },
  trial_balance: { en: "Trial Balance", fr: "Balance générale" },
  pcn: { en: "PCN Closing Balances", fr: "Soldes de clôture PCN" },
  annual_accounts: { en: "Annual Accounts", fr: "Comptes annuels" },
  annexe: { en: "Annexe to the Annual Accounts", fr: "Annexe aux comptes annuels" },
  general_ledger: { en: "General Ledger", fr: "Grand livre" },
  general_journal: { en: "General Journal", fr: "Journal général" },
};

export function financialDocumentName(type: string, locale: Locale) {
  return financialDocumentNames[type]?.[locale] || financialDocumentNames[type]?.en || type;
}
