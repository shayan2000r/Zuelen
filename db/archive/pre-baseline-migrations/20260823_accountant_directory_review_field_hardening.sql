create or replace function app_private.guard_accountant_review_fields()
returns trigger
language plpgsql
security definer
set search_path to 'public','auth','app_private'
as $$
begin
  if auth.uid() is not null then
    if tg_op='INSERT' then
      new.approval_status:='pending';
      new.approved_at:=null;
      new.rejection_reason:=null;
    elsif tg_op='UPDATE' then
      if row(
        new.slug,
        new.full_name,
        new.firm_name,
        new.professional_title,
        new.bio,
        new.location,
        new.languages,
        new.specialties,
        new.business_types,
        new.email,
        new.phone,
        new.website,
        new.photo_url
      ) is distinct from row(
        old.slug,
        old.full_name,
        old.firm_name,
        old.professional_title,
        old.bio,
        old.location,
        old.languages,
        old.specialties,
        old.business_types,
        old.email,
        old.phone,
        old.website,
        old.photo_url
      ) then
        new.approval_status:='pending';
        new.approved_at:=null;
        new.rejection_reason:=null;
      else
        new.approval_status:=old.approval_status;
        new.approved_at:=old.approved_at;
        new.rejection_reason:=old.rejection_reason;
      end if;
    end if;
  end if;
  return new;
end;
$$;
