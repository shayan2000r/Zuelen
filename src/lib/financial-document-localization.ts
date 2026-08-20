import { localizedAccountLabel, normalizeLocale, type AccountTranslation, type Locale } from "@/lib/i18n";

type Payload = Record<string, unknown>;

function obj(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
function arr(value: unknown) {
  return Array.isArray(value) ? value : [];
}
function str(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function localizeFinancialPayload(payload: Payload, requestedLocale: Locale, accounts: AccountTranslation[]) {
  const locale = normalizeLocale(requestedLocale);
  const cloned = structuredClone(payload) as Payload;
  cloned.locale = locale;
  const byCode = new Map(accounts.map((account) => [account.code, account]));
  const display = (code: string, fallback: string) => {
    const account = byCode.get(code);
    return account ? localizedAccountLabel(locale, account) : fallback;
  };

  const snapshot = obj(cloned.ledger_snapshot);
  if (snapshot) {
    snapshot.trial_balance = arr(snapshot.trial_balance).map((raw) => {
      const row = obj(raw);
      if (!row) return raw;
      const code = str(row.code);
      return { ...row, label: display(code, str(row.label)) };
    });
  }

  const localizeEntries = (container: Record<string, unknown> | null) => {
    if (!container) return;
    container.entries = arr(container.entries).map((rawEntry) => {
      const entry = obj(rawEntry);
      if (!entry) return rawEntry;
      return {
        ...entry,
        lines: arr(entry.lines).map((rawLine) => {
          const line = obj(rawLine);
          if (!line) return rawLine;
          const code = str(line.account_code);
          return { ...line, account_label: display(code, str(line.account_label)) };
        }),
      };
    });
  };

  localizeEntries(obj(cloned.journal));
  localizeEntries(obj(cloned.general_ledger));
  return cloned;
}
