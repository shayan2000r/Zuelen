-- Complete Luxembourg PCN2020 hierarchy reference.
-- Source snapshot: official eCDF standard mapping, financial year 2026.
-- https://ecdf.b2g.etat.lu/ecdf/pcnMappingTables?pageTab=standard&selectedPcnYear=2026

create table if not exists public.pcn_account_groups (
  code text not null,
  label_fr text not null,
  account_class integer not null check (account_class between 1 and 7),
  parent_code text,
  source_version text not null,
  source_url text not null,
  verified_at timestamptz not null,
  is_active boolean not null default true,
  primary key (code, source_version)
);

alter table public.pcn_account_groups enable row level security;
grant select on public.pcn_account_groups to authenticated;

drop policy if exists pcn_account_groups_authenticated_read on public.pcn_account_groups;
create policy pcn_account_groups_authenticated_read
  on public.pcn_account_groups
  for select
  to authenticated
  using (true);

comment on table public.pcn_account_groups is
  'Official Luxembourg PCN grouping hierarchy. Posting accounts remain in pcn_accounts.';
