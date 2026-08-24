create table if not exists public.accountant_reviewers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.accountant_reviewers enable row level security;

revoke all on table public.accountant_reviewers from anon, authenticated;

comment on table public.accountant_reviewers is
  'Server-only registry of users allowed to approve or reject accountant directory profiles.';
