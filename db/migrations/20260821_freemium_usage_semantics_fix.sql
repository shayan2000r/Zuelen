-- Bank statement files archived automatically by the Banking import belong to the bank-import allowance,
-- not the separate manual document-upload allowance.
drop trigger if exists documents_enforce_basic_usage on public.documents;
create trigger documents_enforce_basic_usage before insert on public.documents
for each row
when ((new.extracted_data->>'source') is distinct from 'banking_import')
execute function app_private.enforce_usage_before_insert('documents');

drop trigger if exists documents_record_usage on public.documents;
create trigger documents_record_usage after insert on public.documents
for each row
when ((new.extracted_data->>'source') is distinct from 'banking_import')
execute function app_private.record_usage_after_insert('documents');

-- Internal pre-launch workspaces are unrestricted for QA, including team-seat testing.
create or replace function app_private.enforce_invitation_seat()
returns trigger language plpgsql security definer set search_path to 'pg_catalog','public' as $$
declare
  v_purchased integer := 0;
  v_billable integer := 0;
  v_professional_count integer := 0;
  v_increment integer := 1;
  v_source text;
begin
  select coalesce(s.additional_seats,0),s.billing_source into v_purchased,v_source
  from public.organization_subscriptions s where s.organization_id=new.organization_id;

  if v_source='internal' then return new; end if;

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
