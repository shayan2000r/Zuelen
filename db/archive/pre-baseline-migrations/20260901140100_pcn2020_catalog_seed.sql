-- Reproducible PCN2020 seed and English-label enrichment.
--
-- Canonical production classification/hierarchy was verified against the official eCDF
-- standard mapping for 2026 before this migration was authored:
-- https://ecdf.b2g.etat.lu/ecdf/pcnMappingTables?pageTab=standard&selectedPcnYear=2026
--
-- For deterministic replays in fresh environments, this migration uses a commit-pinned
-- copy of Odoo's Luxembourg localization as a transportable secondary reference. It does
-- not overwrite eCDF-derived French labels or classifications when those rows already exist.

create extension if not exists http with schema extensions;

alter table public.pcn_account_groups add column if not exists label_en text;

create temporary table _pcn_odoo_groups (
  code text primary key,
  label_en text not null,
  label_fr text not null
) on commit drop;

with source as (
  select (extensions.http_get(
    'https://raw.githubusercontent.com/odoo/odoo/ef6765208d400aa1252cd4dff5bc074ea551bbc2/addons/l10n_lu/data/template/account.group-lu.csv'
  )).content as csv
), lines as (
  select regexp_split_to_table(csv, E'\\r?\\n') as line from source
), matches as (
  select regexp_match(
    line,
    '^"[^"]+","([^"]+)","[^"]*","((?:[^"]|"")*)","((?:[^"]|"")*)","((?:[^"]|"")*)"$'
  ) as m
  from lines
  where line like '"account_group_%'
)
insert into _pcn_odoo_groups(code,label_en,label_fr)
select replace(m[1],'""','"'), replace(m[2],'""','"'), replace(m[4],'""','"')
from matches
where m is not null and m[1] ~ '^[1-7][0-9]*$';

create temporary table _pcn_odoo_accounts (
  code text primary key,
  label_en text not null,
  label_fr text not null,
  odoo_type text not null
) on commit drop;

with source as (
  select (extensions.http_get(
    'https://raw.githubusercontent.com/odoo/odoo/ef6765208d400aa1252cd4dff5bc074ea551bbc2/addons/l10n_lu/data/template/account.account-lu.csv'
  )).content as csv
), lines as (
  select regexp_split_to_table(csv, E'\\r?\\n') as line from source
), matches as (
  select regexp_match(
    line,
    '^"[^"]+","([^"]+)","((?:[^"]|"")*)",(?:"([^"]+)"|([^,]+)),.*,"((?:[^"]|"")*)","((?:[^"]|"")*)"$'
  ) as m
  from lines
  where line like '"lu_%_account_%'
)
insert into _pcn_odoo_accounts(code,label_en,label_fr,odoo_type)
select
  replace(m[1],'""','"'),
  replace(m[2],'""','"'),
  replace(m[6],'""','"'),
  coalesce(m[3],m[4])
from matches
where m is not null and m[1] ~ '^[1-7][0-9]*$';

do $$
declare v_accounts integer; v_groups integer;
begin
  select count(*) into v_accounts from _pcn_odoo_accounts;
  select count(*) into v_groups from _pcn_odoo_groups;
  if v_accounts < 700 then raise exception 'Pinned Luxembourg PCN account source incomplete: % rows',v_accounts; end if;
  if v_groups < 900 then raise exception 'Pinned Luxembourg PCN group source incomplete: % rows',v_groups; end if;
end $$;

-- Add hierarchy nodes that are not posting accounts. Existing eCDF-derived French labels
-- remain canonical; the pinned reference primarily fills English labels and fresh installs.
insert into public.pcn_account_groups(
  code,label_fr,label_en,account_class,parent_code,source_version,source_url,verified_at,is_active
)
select
  g.code,
  g.label_fr,
  g.label_en,
  left(g.code,1)::integer,
  (
    select parent.code
    from _pcn_odoo_groups parent
    where length(parent.code)<length(g.code)
      and g.code like parent.code||'%'
    order by length(parent.code) desc
    limit 1
  ),
  'PCN2020',
  'https://github.com/odoo/odoo/tree/ef6765208d400aa1252cd4dff5bc074ea551bbc2/addons/l10n_lu',
  timestamptz '2026-09-01 00:00:00+00',
  true
from _pcn_odoo_groups g
where not exists(select 1 from _pcn_odoo_accounts a where a.code=g.code)
on conflict(code,source_version) do update set
  label_en=excluded.label_en,
  label_fr=coalesce(public.pcn_account_groups.label_fr,excluded.label_fr),
  is_active=true;

insert into public.pcn_accounts(
  code,label_fr,label_en,account_type,account_class,parent_code,normal_balance,
  source_version,valid_from,valid_to,is_active
)
select
  a.code,
  a.label_fr,
  a.label_en,
  case
    when a.odoo_type like 'asset_%' then 'asset'
    when a.odoo_type like 'liability_%' then 'liability'
    when a.odoo_type like 'equity%' then 'equity'
    when a.odoo_type like 'expense%' then 'expense'
    when a.odoo_type like 'income%' then 'revenue'
    else case left(a.code,1) when '6' then 'expense' when '7' then 'revenue' else 'memo' end
  end,
  left(a.code,1)::integer,
  (
    select g.code
    from _pcn_odoo_groups g
    where length(g.code)<length(a.code)
      and a.code like g.code||'%'
    order by length(g.code) desc
    limit 1
  ),
  case
    when a.odoo_type like 'asset_%' or a.odoo_type like 'expense%' then 'debit'
    else 'credit'
  end,
  'PCN2020',date '2020-01-01',null,true
from _pcn_odoo_accounts a
on conflict(code,source_version) do update set
  label_en=excluded.label_en,
  label_fr=coalesce(public.pcn_accounts.label_fr,excluded.label_fr),
  is_active=true;

-- eCDF presents the financial-year result as a result line rather than an ordinary mapped
-- balance-sheet imputation line. Zuelen keeps 142 explicitly so a printed result can be
-- carried into an opening position only when it exactly reconciles the extracted balance.
insert into public.pcn_accounts(
  code,label_fr,label_en,account_type,account_class,parent_code,normal_balance,
  source_version,valid_from,valid_to,is_active
)
values (
  '142','Résultat de l''exercice','Result for the financial year','equity',1,'14','credit',
  'PCN2020',date '2020-01-01',null,true
)
on conflict(code,source_version) do update set
  label_fr=excluded.label_fr,
  label_en=excluded.label_en,
  account_type='equity',
  account_class=1,
  parent_code='14',
  normal_balance='credit',
  valid_to=null,
  is_active=true;

do $$
declare v_accounts integer; v_groups integer;
begin
  select count(*) into v_accounts from public.pcn_accounts where source_version='PCN2020' and is_active;
  select count(*) into v_groups from public.pcn_account_groups where source_version='PCN2020' and is_active;
  if v_accounts < 740 then raise exception 'PCN2020 posting catalog incomplete: % rows',v_accounts; end if;
  if v_groups < 250 then raise exception 'PCN2020 hierarchy incomplete: % rows',v_groups; end if;
  if not exists(
    select 1 from public.pcn_accounts
    where code='2362' and source_version='PCN2020' and account_type='asset' and parent_code='236'
  ) then raise exception 'PCN account 2362 is missing or misclassified';
end $$;
