const technicalPatterns = [
  /new row for relation/i,
  /violates .*constraint/i,
  /duplicate key value/i,
  /foreign key constraint/i,
  /null value in column/i,
  /invalid input syntax for type/i,
  /relation ".+" does not exist/i,
  /column ".+" does not exist/i,
  /function .+ does not exist/i,
  /operator does not exist/i,
  /schema cache/i,
  /postgrest/i,
  /\bPGRST\d+\b/i,
  /\bSQLSTATE\b/i,
  /permission denied for (table|schema|relation|sequence|function)/i,
  /current transaction is aborted/i,
  /deadlock detected/i,
  /could not serialize access/i,
  /DETAIL:/i,
  /Key \(.+\)=\(.+\)/i,
];

export function sanitizePublicErrorMessage(message: string | null | undefined, fallback: string) {
  const value = (message ?? "").trim();
  if (!value) return fallback;
  if (value.length > 260 || technicalPatterns.some(pattern => pattern.test(value))) return fallback;
  return value;
}
