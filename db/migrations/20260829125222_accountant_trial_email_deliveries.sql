create table if not exists public.transactional_email_deliveries (
  delivery_key text primary key,
  kind text not null,
  status text not null default 'processing',
  external_id text,
  processing_started_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactional_email_deliveries_kind_check
    check (kind in ('accountant_trial_confirmation')),
  constraint transactional_email_deliveries_status_check
    check (status in ('processing', 'sent', 'failed'))
);

alter table public.transactional_email_deliveries enable row level security;

revoke all on table public.transactional_email_deliveries from anon, authenticated;
grant select, insert, update on table public.transactional_email_deliveries to service_role;

create index if not exists transactional_email_deliveries_status_started_idx
  on public.transactional_email_deliveries(status, processing_started_at);

comment on table public.transactional_email_deliveries is
  'Server-only delivery ledger for retry-safe transactional email. Recipient and message bodies are deliberately not retained.';
