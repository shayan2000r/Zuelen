create table if not exists public.early_access_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  audience text not null,
  locale text not null default 'fr',
  referral_code text,
  source text not null default 'website',
  status text not null default 'waiting',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  invited_at timestamptz,
  activated_at timestamptz,
  constraint early_access_waitlist_email_lowercase_check check (email = lower(email)),
  constraint early_access_waitlist_audience_check check (audience in ('independent','company','accountant')),
  constraint early_access_waitlist_locale_check check (locale in ('fr','en')),
  constraint early_access_waitlist_source_check check (source in ('website','referral','manual')),
  constraint early_access_waitlist_status_check check (status in ('waiting','approved','invited','activated','rejected')),
  constraint early_access_waitlist_referral_length_check check (referral_code is null or char_length(referral_code) <= 64)
);

alter table public.early_access_waitlist enable row level security;
revoke all on table public.early_access_waitlist from anon, authenticated;
grant insert on table public.early_access_waitlist to anon, authenticated;
grant select, insert, update, delete on table public.early_access_waitlist to service_role;

drop policy if exists "Public can join early access waitlist" on public.early_access_waitlist;
create policy "Public can join early access waitlist"
  on public.early_access_waitlist
  for insert
  to anon, authenticated
  with check (
    status = 'waiting'
    and source = 'website'
    and approved_at is null
    and invited_at is null
    and activated_at is null
  );

create index if not exists early_access_waitlist_status_created_idx
  on public.early_access_waitlist(status, created_at desc);

create table if not exists public.early_access_allowed_emails (
  email text primary key,
  source text not null default 'existing_user',
  created_at timestamptz not null default now(),
  constraint early_access_allowed_email_lowercase_check check (email = lower(email)),
  constraint early_access_allowed_source_check check (source in ('existing_user','waitlist_approval','manual'))
);

alter table public.early_access_allowed_emails enable row level security;
revoke all on table public.early_access_allowed_emails from anon, authenticated;
grant select, insert, update, delete on table public.early_access_allowed_emails to service_role;

insert into public.early_access_allowed_emails(email, source)
select lower(email), 'existing_user'
from auth.users
where email is not null
on conflict (email) do nothing;

create table if not exists public.early_access_reviewers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.early_access_reviewers enable row level security;
revoke all on table public.early_access_reviewers from anon, authenticated;
grant select, insert, delete on table public.early_access_reviewers to service_role;

comment on table public.early_access_waitlist is
  'Public early-access requests. Public clients may insert only; review and invitation are server-only.';
comment on table public.early_access_allowed_emails is
  'Server-only access registry used to grandfather existing users and approve early-access invitees.';
comment on table public.early_access_reviewers is
  'Server-only registry of users authorized to review and invite early-access applicants.';
