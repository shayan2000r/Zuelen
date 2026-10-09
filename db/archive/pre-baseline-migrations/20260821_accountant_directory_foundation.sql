create table if not exists public.accountant_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  slug text not null unique,
  full_name text not null,
  firm_name text,
  professional_title text not null default 'Accountant',
  bio text,
  location text,
  languages text[] not null default '{}',
  specialties text[] not null default '{}',
  business_types text[] not null default '{}',
  email text,
  phone text,
  website text,
  photo_url text,
  accepting_new_clients boolean not null default true,
  works_remotely boolean not null default true,
  works_in_person boolean not null default true,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accountant_listing_subscriptions (
  profile_id uuid primary key references public.accountant_profiles(id) on delete cascade,
  tier text not null check (tier in ('basic','premium')),
  status text not null default 'incomplete' check (status in ('active','trialing','past_due','unpaid','incomplete','canceled')),
  trial_end timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists accountant_listing_subscriptions_customer_idx
  on public.accountant_listing_subscriptions(stripe_customer_id) where stripe_customer_id is not null;
create unique index if not exists accountant_listing_subscriptions_subscription_idx
  on public.accountant_listing_subscriptions(stripe_subscription_id) where stripe_subscription_id is not null;
create index if not exists accountant_profiles_directory_idx
  on public.accountant_profiles(approval_status,location,updated_at desc);

create table if not exists public.accountant_profile_events (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.accountant_profiles(id) on delete cascade,
  event_type text not null check (event_type in ('view','email','phone','website')),
  viewer_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists accountant_profile_events_owner_idx
  on public.accountant_profile_events(profile_id,created_at desc);

alter table public.accountant_profiles enable row level security;
alter table public.accountant_listing_subscriptions enable row level security;
alter table public.accountant_profile_events enable row level security;

create or replace function app_private.owns_accountant_profile(target_profile_id uuid)
returns boolean language sql stable security definer
set search_path to 'public','auth','app_private' as $$
  select exists(select 1 from public.accountant_profiles p where p.id=target_profile_id and p.user_id=auth.uid());
$$;

create or replace function app_private.accountant_profile_is_public(target_profile_id uuid)
returns boolean language sql stable security definer
set search_path to 'public','auth','app_private' as $$
  select exists(
    select 1 from public.accountant_profiles p
    join public.accountant_listing_subscriptions s on s.profile_id=p.id
    where p.id=target_profile_id
      and p.approval_status='approved'
      and s.status in ('trialing','active','past_due')
  );
$$;

create or replace function app_private.guard_accountant_review_fields()
returns trigger language plpgsql security definer
set search_path to 'public','auth','app_private' as $$
begin
  if auth.uid() is not null then
    if tg_op='INSERT' then
      new.approval_status:='pending'; new.approved_at:=null; new.rejection_reason:=null;
    elsif tg_op='UPDATE' then
      if row(new.full_name,new.firm_name,new.professional_title,new.bio,new.location,new.languages,new.specialties,new.business_types,new.website,new.photo_url)
        is distinct from row(old.full_name,old.firm_name,old.professional_title,old.bio,old.location,old.languages,old.specialties,old.business_types,old.website,old.photo_url) then
        new.approval_status:='pending'; new.approved_at:=null; new.rejection_reason:=null;
      else
        new.approval_status:=old.approval_status; new.approved_at:=old.approved_at; new.rejection_reason:=old.rejection_reason;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists accountant_profiles_guard_review on public.accountant_profiles;
create trigger accountant_profiles_guard_review before insert or update on public.accountant_profiles
for each row execute function app_private.guard_accountant_review_fields();

create or replace function app_private.touch_accountant_updated_at()
returns trigger language plpgsql security definer
set search_path to 'public','app_private' as $$ begin new.updated_at=now(); return new; end; $$;

drop trigger if exists accountant_profiles_touch_updated_at on public.accountant_profiles;
create trigger accountant_profiles_touch_updated_at before update on public.accountant_profiles
for each row execute function app_private.touch_accountant_updated_at();
drop trigger if exists accountant_listing_subscriptions_touch_updated_at on public.accountant_listing_subscriptions;
create trigger accountant_listing_subscriptions_touch_updated_at before update on public.accountant_listing_subscriptions
for each row execute function app_private.touch_accountant_updated_at();

drop policy if exists accountant_profiles_select on public.accountant_profiles;
create policy accountant_profiles_select on public.accountant_profiles for select to authenticated
using (user_id=auth.uid() or app_private.accountant_profile_is_public(id));
drop policy if exists accountant_profiles_insert on public.accountant_profiles;
create policy accountant_profiles_insert on public.accountant_profiles for insert to authenticated with check (user_id=auth.uid());
drop policy if exists accountant_profiles_update on public.accountant_profiles;
create policy accountant_profiles_update on public.accountant_profiles for update to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists accountant_listing_subscriptions_select on public.accountant_listing_subscriptions;
create policy accountant_listing_subscriptions_select on public.accountant_listing_subscriptions for select to authenticated
using (app_private.owns_accountant_profile(profile_id) or app_private.accountant_profile_is_public(profile_id));
drop policy if exists accountant_profile_events_select on public.accountant_profile_events;
create policy accountant_profile_events_select on public.accountant_profile_events for select to authenticated
using (app_private.owns_accountant_profile(profile_id));

revoke all on public.accountant_profiles from anon,authenticated;
revoke all on public.accountant_listing_subscriptions from anon,authenticated;
revoke all on public.accountant_profile_events from anon,authenticated;
grant select,insert,update on public.accountant_profiles to authenticated;
grant select on public.accountant_listing_subscriptions to authenticated;
grant select on public.accountant_profile_events to authenticated;

revoke all on function app_private.owns_accountant_profile(uuid) from public;
revoke all on function app_private.accountant_profile_is_public(uuid) from public;
grant execute on function app_private.owns_accountant_profile(uuid) to authenticated;
grant execute on function app_private.accountant_profile_is_public(uuid) to authenticated;
