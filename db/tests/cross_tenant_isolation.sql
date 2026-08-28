-- Run against a non-production database containing at least two organizations.
-- The transaction is read-only from the application's perspective and rolls back.
\set ON_ERROR_STOP on

begin;

create temporary table security_test_identities on commit drop as
select user_id, organization_id, row_number() over (order by created_at, user_id) as n
from public.organization_members;

do $$
begin
  if (select count(*) from security_test_identities) < 2 then
    raise exception 'Cross-tenant test requires at least two organization memberships';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', (select user_id::text from security_test_identities where n = 1), true);

do $$
declare
  target uuid := (select organization_id from security_test_identities where n = 2);
begin
  if exists (select 1 from public.organization_members where organization_id = target)
    or exists (select 1 from public.source_transactions where organization_id = target)
    or exists (select 1 from public.bank_transactions where organization_id = target)
    or exists (select 1 from public.sales_invoices where organization_id = target)
    or exists (select 1 from public.documents where organization_id = target)
    or exists (select 1 from public.journal_entries where organization_id = target)
  then
    raise exception 'Cross-tenant read isolation failed for first test identity';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', (select user_id::text from security_test_identities where n = 2), true);

do $$
declare
  target uuid := (select organization_id from security_test_identities where n = 1);
begin
  if exists (select 1 from public.organization_members where organization_id = target)
    or exists (select 1 from public.source_transactions where organization_id = target)
    or exists (select 1 from public.bank_transactions where organization_id = target)
    or exists (select 1 from public.sales_invoices where organization_id = target)
    or exists (select 1 from public.documents where organization_id = target)
    or exists (select 1 from public.journal_entries where organization_id = target)
  then
    raise exception 'Cross-tenant read isolation failed for second test identity';
  end if;
end;
$$;

rollback;
