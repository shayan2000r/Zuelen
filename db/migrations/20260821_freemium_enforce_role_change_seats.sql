create or replace function app_private.enforce_member_seat_after_role_update()
returns trigger language plpgsql security definer set search_path to 'pg_catalog','public' as $$
declare
  v_purchased integer := 0;
  v_billable integer := 0;
  v_source text;
begin
  if new.role is not distinct from old.role then return new; end if;
  select coalesce(s.additional_seats,0),s.billing_source into v_purchased,v_source
  from public.organization_subscriptions s where s.organization_id=new.organization_id;
  if v_source='internal' then return new; end if;
  v_billable := app_private.billable_team_seats(new.organization_id);
  if v_billable > v_purchased then
    raise exception 'ZU_SEAT_LIMIT:%:%',v_billable,v_purchased using errcode='P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists organization_members_enforce_role_seat on public.organization_members;
create trigger organization_members_enforce_role_seat
after update of role on public.organization_members
for each row execute function app_private.enforce_member_seat_after_role_update();
