-- Bank statement imports support structured CSV/XLSX files and AI-extracted PDFs.
-- Keep import_source constrained to known ingestion paths while matching the application values.

alter table public.bank_transactions
  drop constraint if exists bank_transactions_import_source_check;

alter table public.bank_transactions
  add constraint bank_transactions_import_source_check
  check (import_source in ('manual','csv','xlsx','pdf_ai','camt','psd2'));
