-- Focused production hardening: authenticated-only private data access,
-- atomic per-user abuse protection, and secure defaults for future objects.

alter policy classification_rules_select on public.classification_rules to authenticated;
alter policy document_links_select on public.document_transaction_links to authenticated;
alter policy documents_delete on public.documents to authenticated;
alter policy documents_select on public.documents to authenticated;
alter policy generated_documents_select on public.generated_documents to authenticated;
alter policy invoice_payments_insert on public.invoice_payments to authenticated;
alter policy invoice_payments_select on public.invoice_payments to authenticated;
alter policy sales_invoice_lines_insert on public.sales_invoice_lines to authenticated;
alter policy sales_invoices_insert on public.sales_invoices to authenticated;
alter policy sales_invoices_update on public.sales_invoices to authenticated;
alter policy tax_events_select on public.tax_events to authenticated;

revoke all privileges on table public.bank_import_batches from anon;
revoke all privileges on table public.classification_rules from anon;
revoke all privileges on table public.copilot_conversations from anon;
revoke all privileges on table public.copilot_messages from anon;
revoke all privileges on table public.document_transaction_links from anon;
revoke all privileges on table public.documents from anon;
revoke all privileges on table public.generated_documents from anon;
revoke all privileges on table public.invoice_payments from anon;
revoke all privileges on table public.organization_invitations from anon;
revoke all privileges on table public.sales_invoice_lines from anon;
revoke all privileges on table public.sales_invoices from anon;
revoke all privileges on table public.tax_events from anon;

alter table public.stripe_webhook_events
  add column if not exists status text not null default 'processed',
  add column if not exists processing_started_at timestamptz,
  add column if not exists last_error text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.stripe_webhook_events'::regclass
      and conname = 'stripe_webhook_events_status_check'
  ) then
    alter table public.stripe_webhook_events
      add constraint stripe_webhook_events_status_check check (status in ('processing', 'processed', 'failed'));
  end if;
end;
$$;

create table if not exists app_private.security_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('bank_import', 'checkout', 'copilot', 'document_extract')),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, action)
);

revoke all on table app_private.security_rate_limits from public, anon, authenticated;

create or replace function public.consume_security_rate_limit(p_action text)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_window interval;
  v_limit integer;
  v_count integer;
  v_started_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select limits.window_size, limits.max_requests
    into v_window, v_limit
  from (values
    ('bank_import'::text, interval '10 minutes', 10),
    ('checkout'::text, interval '10 minutes', 6),
    ('copilot'::text, interval '5 minutes', 30),
    ('document_extract'::text, interval '10 minutes', 10)
  ) as limits(action, window_size, max_requests)
  where limits.action = p_action;

  if v_limit is null then
    raise exception 'Unsupported rate-limit action';
  end if;

  insert into app_private.security_rate_limits as bucket (
    user_id, action, window_started_at, request_count, updated_at
  ) values (
    v_user_id, p_action, now(), 1, now()
  )
  on conflict (user_id, action) do update
    set window_started_at = case
          when bucket.window_started_at + v_window <= now() then now()
          else bucket.window_started_at
        end,
        request_count = case
          when bucket.window_started_at + v_window <= now() then 1
          else bucket.request_count + 1
        end,
        updated_at = now()
  returning request_count, window_started_at into v_count, v_started_at;

  return query select
    v_count <= v_limit,
    case
      when v_count <= v_limit then 0
      else greatest(1, ceil(extract(epoch from ((v_started_at + v_window) - now())))::integer)
    end;
end;
$$;

revoke all on function public.consume_security_rate_limit(text) from public, anon;
grant execute on function public.consume_security_rate_limit(text) to authenticated;

comment on function public.consume_security_rate_limit(text) is
  'Atomically applies conservative per-user limits to authenticated expensive actions.';

alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from public;
