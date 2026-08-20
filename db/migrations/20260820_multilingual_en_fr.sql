-- English/French localization metadata. This migration mirrors the additive production changes.

alter table if exists public.user_profiles
  add column if not exists locale text not null default 'en';

alter table if exists public.user_profiles
  drop constraint if exists user_profiles_locale_check;
alter table if exists public.user_profiles
  add constraint user_profiles_locale_check check (locale in ('en','fr'));

alter table if exists public.company_accounts
  add column if not exists label_en text,
  add column if not exists label_fr text;

update public.company_accounts ca
set
  label_en = coalesce(nullif(ca.label_en,''), nullif(p.label_en,''), ca.label),
  label_fr = coalesce(nullif(ca.label_fr,''), nullif(p.label_fr,''), ca.label)
from public.pcn_accounts p
where p.code = ca.code
  and (ca.label_en is null or ca.label_fr is null or ca.label_en='' or ca.label_fr='');

update public.company_accounts
set
  label_en = coalesce(nullif(label_en,''), label),
  label_fr = coalesce(nullif(label_fr,''), label)
where label_en is null or label_fr is null or label_en='' or label_fr='';
