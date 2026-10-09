create table if not exists public.organization_subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan text not null default 'basic' check (plan in ('basic','premium')),
  status text not null default 'active' check (status in ('active','trialing','past_due','unpaid','incomplete','canceled')),
  billing_source text not null default 'stripe' check (billing_source in ('stripe','internal')),
  billing_interval text check (billing_interval is null or billing_interval in ('month','year')),
  billing_anchor timestamptz not null default now(),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_customer_id text,
  stripe_plan_subscription_id text,
  stripe_seat_subscription_id text,
  stripe_plan_price_id text,
  stripe_seat_price_id text,
  additional_seats integer not null default 0 check (additional_seats >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organization_subscriptions_stripe_customer_uidx
  on public.organization_subscriptions(stripe_customer_id)
  where stripe_customer_id is not null;
create unique index if not exists organization_subscriptions_plan_subscription_uidx
  on public.organization_subscriptions(stripe_plan_subscription_id)
  where stripe_plan_subscription_id is not null;
create unique index if not exists organization_subscriptions_seat_subscription_uidx
  on public.organization_subscriptions(stripe_seat_subscription_id)
  where stripe_seat_subscription_id is not null;

create table if not exists public.organization_usage_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric text not null check (metric in ('transactions','documents','invoices','bank_imports','copilot')),
  quantity integer not null default 1 check (quantity > 0),
  source_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists organization_usage_events_lookup_idx
  on public.organization_usage_events(organization_id,metric,created_at);

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.organization_subscriptions enable row level security;
alter table public.organization_usage_events enable row level security;
alter table public.stripe_webhook_events enable row level security;

create policy organization_subscriptions_member_read
  on public.organization_subscriptions for select to authenticated
  using (app_private.is_org_member(organization_id));
create policy organization_usage_events_member_read
  on public.organization_usage_events for select to authenticated
  using (app_private.is_org_member(organization_id));

revoke all on public.organization_subscriptions from anon, authenticated;
revoke all on public.organization_usage_events from anon, authenticated;
revoke all on public.stripe_webhook_events from anon, authenticated;
grant select on public.organization_subscriptions to authenticated;
grant select on public.organization_usage_events to authenticated;

create or replace function app_private.touch_subscription_updated_at()
returns trigger language plpgsql set search_path to 'pg_catalog','public' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists organization_subscriptions_touch_updated_at on public.organization_subscriptions;
create trigger organization_subscriptions_touch_updated_at
before update on public.organization_subscriptions
for each row execute function app_private.touch_subscription_updated_at();

create or replace function app_private.create_basic_subscription()
returns trigger language plpgsql security definer set search_path to 'pg_catalog','public' as $$
begin
  insert into public.organization_subscriptions(organization_id,plan,status,billing_source,billing_anchor)
  values(new.id,'basic','active','stripe',coalesce(new.created_at,now()))
  on conflict (organization_id) do nothing;
  return new;
end;
$$;
drop trigger if exists organizations_create_basic_subscription on public.organizations;
create trigger organizations_create_basic_subscription
after insert on public.organizations
for each row execute function app_private.create_basic_subscription();

-- Keep pre-launch workspaces fully enabled. New organizations start on Basic.
insert into public.organization_subscriptions(
  organization_id,plan,status,billing_source,billing_anchor,current_period_start,current_period_end
)
select o.id,'premium','active','internal',o.created_at,o.created_at,o.created_at + interval '100 years'
from public.organizations o
on conflict (organization_id) do nothing;

create or replace function app_private.subscription_period_bounds(p_organization_id uuid)
returns table(period_start timestamptz, period_end timestamptz)
language plpgsql stable security definer set search_path to 'pg_catalog','public' as $$
declare
  v_anchor timestamptz;
  v_current_start timestamptz;
  v_current_end timestamptz;
  v_months integer;
begin
  select s.billing_anchor,s.current_period_start,s.current_period_end
    into v_anchor,v_current_start,v_current_end
  from public.organization_subscriptions s
  where s.organization_id=p_organization_id;

  if v_anchor is null then
    select o.created_at into v_anchor from public.organizations o where o.id=p_organization_id;
  end if;

  if v_current_start is not null and v_current_end is not null and now() >= v_current_start and now() < v_current_end then
    return query select v_current_start,v_current_end;
    return;
  end if;

  v_months := greatest(0,
    (extract(year from age(now(),v_anchor))::integer * 12) + extract(month from age(now(),v_anchor))::integer
  );
  period_start := v_anchor + make_interval(months => v_months);
  if period_start > now() then
    v_months := greatest(0,v_months-1);
    period_start := v_anchor + make_interval(months => v_months);
  end if;
  period_end := v_anchor + make_interval(months => v_months+1);
  return next;
end;
$$;

create or replace function app_private.metric_limit(p_metric text)
returns integer language sql immutable set search_path to 'pg_catalog','public' as $$
  select case p_metric
    when 'transactions' then 15
    when 'documents' then 3
    when 'invoices' then 3
    when 'bank_imports' then 1
    else null
  end
$$;

create or replace function app_private.is_premium(p_organization_id uuid)
returns boolean language sql stable security definer set search_path to 'pg_catalog','public' as $$
  select coalesce((
    select s.plan='premium' and s.status in ('active','trialing','past_due')
    from public.organization_subscriptions s
    where s.organization_id=p_organization_id
  ),false)
$$;

create or replace function public.has_premium_access(p_organization_id uuid)
returns boolean language plpgsql stable security definer set search_path to 'pg_catalog','public' as $$
begin
  if not app_private.is_org_member(p_organization_id) then
    raise exception 'Not authorized to view this organization';
  end if;
  return app_private.is_premium(p_organization_id);
end;
$$;

create or replace function app_private.usage_count(p_organization_id uuid,p_metric text)
returns integer language plpgsql stable security definer set search_path to 'pg_catalog','public' as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_used integer;
begin
  select b.period_start,b.period_end into v_start,v_end
  from app_private.subscription_period_bounds(p_organization_id) b;
  select coalesce(sum(e.quantity),0)::integer into v_used
  from public.organization_usage_events e
  where e.organization_id=p_organization_id
    and e.metric=p_metric
    and e.created_at>=v_start and e.created_at<v_end;
  return coalesce(v_used,0);
end;
$$;

create or replace function public.assert_usage_available(p_organization_id uuid,p_metric text,p_quantity integer default 1)
returns boolean language plpgsql security definer set search_path to 'pg_catalog','public' as $$
declare
  v_limit integer;
  v_used integer;
begin
  if not app_private.is_org_member(p_organization_id) then
    raise exception 'Not authorized to use this organization';
  end if;
  if p_quantity < 1 then raise exception 'Usage quantity must be positive'; end if;
  if app_private.is_premium(p_organization_id) then return true; end if;
  v_limit := app_private.metric_limit(p_metric);
  if v_limit is null then return true; end if;
  v_used := app_private.usage_count(p_organization_id,p_metric);
  if v_used + p_quantity > v_limit then
    raise exception 'ZU_BILLING_LIMIT:%:%:%',p_metric,v_used,v_limit using errcode='P0001';
  end if;
  return true;
end;
$$;

create or replace function app_private.enforce_usage_before_insert()
returns trigger language plpgsql security definer set search_path to 'pg_catalog','public' as $$
declare
  v_metric text := tg_argv[0];
  v_org uuid;
begin
  v_org := new.organization_id;
  if not app_private.is_premium(v_org) then
    perform public.assert_usage_available(v_org,v_metric,1);
  end if;
  return new;
end;
$$;

create or replace function app_private.record_usage_after_insert()
returns trigger language plpgsql security definer set search_path to 'pg_catalog','public' as $$
declare
  v_metric text := tg_argv[0];
begin
  insert into public.organization_usage_events(organization_id,metric,quantity,source_id,created_at)
  values(new.organization_id,v_metric,1,new.id,coalesce(new.created_at,now()));
  return new;
end;
$$;

drop trigger if exists source_transactions_enforce_basic_usage on public.source_transactions;
create trigger source_transactions_enforce_basic_usage before insert on public.source_transactions
for each row when (new.source_type in ('manual','bank','import')) execute function app_private.enforce_usage_before_insert('transactions');
drop trigger if exists source_transactions_record_usage on public.source_transactions;
create trigger source_transactions_record_usage after insert on public.source_transactions
for each row when (new.source_type in ('manual','bank','import')) execute function app_private.record_usage_after_insert('transactions');

drop trigger if exists documents_enforce_basic_usage on public.documents;
create trigger documents_enforce_basic_usage before insert on public.documents
for each row execute function app_private.enforce_usage_before_insert('documents');
drop trigger if exists documents_record_usage on public.documents;
create trigger documents_record_usage after insert on public.documents
for each row execute function app_private.record_usage_after_insert('documents');

drop trigger if exists sales_invoices_enforce_basic_usage on public.sales_invoices;
create trigger sales_invoices_enforce_basic_usage before insert on public.sales_invoices
for each row execute function app_private.enforce_usage_before_insert('invoices');
drop trigger if exists sales_invoices_record_usage on public.sales_invoices;
create trigger sales_invoices_record_usage after insert on public.sales_invoices
for each row execute function app_private.record_usage_after_insert('invoices');

drop trigger if exists bank_import_batches_enforce_basic_usage on public.bank_import_batches;
create trigger bank_import_batches_enforce_basic_usage before insert on public.bank_import_batches
for each row execute function app_private.enforce_usage_before_insert('bank_imports');
drop trigger if exists bank_import_batches_record_usage on public.bank_import_batches;
create trigger bank_import_batches_record_usage after insert on public.bank_import_batches
for each row execute function app_private.record_usage_after_insert('bank_imports');

create or replace function app_private.billable_team_seats(p_organization_id uuid)
returns integer language plpgsql stable security definer set search_path to 'pg_catalog','public' as $$
declare
  v_professional integer;
  v_other integer;
  v_pending_professional integer;
  v_pending_other integer;
begin
  select
    count(*) filter (where om.role in ('accountant','bookkeeper')),
    count(*) filter (where om.role in ('admin','viewer') and om.user_id<>o.owner_id)
  into v_professional,v_other
  from public.organization_members om
  join public.organizations o on o.id=om.organization_id
  where om.organization_id=p_organization_id;

  select
    count(*) filter (where oi.role in ('accountant','bookkeeper')),
    count(*) filter (where oi.role in ('admin','viewer'))
  into v_pending_professional,v_pending_other
  from public.organization_invitations oi
  where oi.organization_id=p_organization_id and oi.status='pending' and oi.expires_at>now();

  return greatest(0,coalesce(v_professional,0)+coalesce(v_pending_professional,0)-1)
    + coalesce(v_other,0)+coalesce(v_pending_other,0);
end;
$$;

create or replace function app_private.enforce_invitation_seat()
returns trigger language plpgsql security definer set search_path to 'pg_catalog','public' as $$
declare
  v_purchased integer := 0;
  v_billable integer := 0;
  v_professional_count integer := 0;
  v_increment integer := 1;
begin
  select coalesce(s.additional_seats,0) into v_purchased
  from public.organization_subscriptions s where s.organization_id=new.organization_id;

  v_billable := app_private.billable_team_seats(new.organization_id);
  if new.role in ('accountant','bookkeeper') then
    select (
      (select count(*) from public.organization_members om where om.organization_id=new.organization_id and om.role in ('accountant','bookkeeper'))
      +
      (select count(*) from public.organization_invitations oi where oi.organization_id=new.organization_id and oi.status='pending' and oi.expires_at>now() and oi.role in ('accountant','bookkeeper'))
    ) into v_professional_count;
    if coalesce(v_professional_count,0)=0 then v_increment:=0; end if;
  end if;

  if v_billable + v_increment > v_purchased then
    raise exception 'ZU_SEAT_LIMIT:%:%',v_billable,v_purchased using errcode='P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists organization_invitations_enforce_seat on public.organization_invitations;
create trigger organization_invitations_enforce_seat
before insert on public.organization_invitations
for each row execute function app_private.enforce_invitation_seat();

create or replace function public.get_billing_snapshot(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog','public' as $$
declare
  v_sub public.organization_subscriptions%rowtype;
  v_start timestamptz;
  v_end timestamptz;
  v_transactions integer;
  v_documents integer;
  v_invoices integer;
  v_bank_imports integer;
  v_billable_seats integer;
begin
  if not app_private.is_org_member(p_organization_id) then
    raise exception 'Not authorized to view this organization';
  end if;
  select * into v_sub from public.organization_subscriptions s where s.organization_id=p_organization_id;
  if v_sub.organization_id is null then
    insert into public.organization_subscriptions(organization_id,plan,status,billing_source,billing_anchor)
    select o.id,'basic','active','stripe',o.created_at from public.organizations o where o.id=p_organization_id
    on conflict (organization_id) do nothing;
    select * into v_sub from public.organization_subscriptions s where s.organization_id=p_organization_id;
  end if;
  select b.period_start,b.period_end into v_start,v_end from app_private.subscription_period_bounds(p_organization_id) b;
  v_transactions:=app_private.usage_count(p_organization_id,'transactions');
  v_documents:=app_private.usage_count(p_organization_id,'documents');
  v_invoices:=app_private.usage_count(p_organization_id,'invoices');
  v_bank_imports:=app_private.usage_count(p_organization_id,'bank_imports');
  v_billable_seats:=app_private.billable_team_seats(p_organization_id);
  return jsonb_build_object(
    'plan',v_sub.plan,
    'status',v_sub.status,
    'billing_source',v_sub.billing_source,
    'billing_interval',v_sub.billing_interval,
    'period_start',v_start,
    'period_end',v_end,
    'cancel_at_period_end',v_sub.cancel_at_period_end,
    'additional_seats',v_sub.additional_seats,
    'billable_seats',v_billable_seats,
    'stripe_customer_id',v_sub.stripe_customer_id,
    'stripe_plan_subscription_id',v_sub.stripe_plan_subscription_id,
    'stripe_seat_subscription_id',v_sub.stripe_seat_subscription_id,
    'usage',jsonb_build_object(
      'transactions',jsonb_build_object('used',v_transactions,'limit',case when v_sub.plan='premium' then null else 15 end),
      'documents',jsonb_build_object('used',v_documents,'limit',case when v_sub.plan='premium' then null else 3 end),
      'invoices',jsonb_build_object('used',v_invoices,'limit',case when v_sub.plan='premium' then null else 3 end),
      'bank_imports',jsonb_build_object('used',v_bank_imports,'limit',case when v_sub.plan='premium' then null else 1 end)
    )
  );
end;
$$;

revoke all on function public.has_premium_access(uuid) from public,anon;
revoke all on function public.assert_usage_available(uuid,text,integer) from public,anon;
revoke all on function public.get_billing_snapshot(uuid) from public,anon;
grant execute on function public.has_premium_access(uuid) to authenticated;
grant execute on function public.assert_usage_available(uuid,text,integer) to authenticated;
grant execute on function public.get_billing_snapshot(uuid) to authenticated;
