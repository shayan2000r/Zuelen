-- Accountant professional preferences and review-decision notifications.
-- Runtime prerequisite: Supabase Vault secret named
-- `zuelen_resend_review_notifications` containing a restricted Resend send-only key.

create extension if not exists pg_net with schema extensions;

alter table public.user_profiles
  add column if not exists professional_email_updates boolean not null default true;

create or replace function app_private.notify_accountant_review_decision()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  resend_key text;
  recipient_email text;
  locale_code text := 'en';
  subject_line text;
  text_body text;
  html_body text;
  safe_name text;
  safe_reason text;
  cta_url text;
begin
  if new.approval_status is not distinct from old.approval_status then
    return new;
  end if;
  if new.approval_status not in ('approved','rejected') then
    return new;
  end if;

  select u.email into recipient_email
  from auth.users u
  where u.id = new.user_id;
  if recipient_email is null or position('@' in recipient_email) = 0 then
    return new;
  end if;

  select coalesce(up.locale, 'en') into locale_code
  from public.user_profiles up
  where up.user_id = new.user_id;
  locale_code := coalesce(locale_code, 'en');

  select decrypted_secret into resend_key
  from vault.decrypted_secrets
  where name = 'zuelen_resend_review_notifications'
  limit 1;
  if resend_key is null then
    raise warning 'Zuelen review notification secret is missing';
    return new;
  end if;

  safe_name := replace(replace(replace(coalesce(new.full_name, 'there'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
  safe_reason := replace(replace(replace(coalesce(new.rejection_reason, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
  cta_url := case when new.approval_status = 'approved'
    then 'https://app.zuelen.lu/professional'
    else 'https://app.zuelen.lu/professional/profile'
  end;

  if locale_code = 'fr' then
    if new.approval_status = 'approved' then
      subject_line := 'Votre profil professionnel Zuelen est approuvé';
      text_body := 'Bonjour ' || coalesce(new.full_name, '') || E',\n\nBonne nouvelle : votre profil professionnel Zuelen a été approuvé. Si votre abonnement est éligible, votre profil est maintenant visible dans l’annuaire.\n\nOuvrir mon espace professionnel : ' || cta_url || E'\n\n— L’équipe Zuelen';
      html_body := '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"></head><body style="margin:0;background-color:#f7f8f5;font-family:Arial,Helvetica,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f8f5"><tr><td align="center" style="padding-top:36px;padding-right:18px;padding-bottom:36px;padding-left:18px;"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #dfe4dc;border-radius:18px;"><tr><td style="padding-top:30px;padding-right:32px;padding-bottom:12px;padding-left:32px;"><img src="https://zuelen.lu/zuelen-icon.png" width="42" height="42" border="0" alt="Zuelen" style="display:block;width:42px;height:42px;"></td></tr><tr><td style="padding-top:12px;padding-right:32px;padding-bottom:8px;padding-left:32px;font-family:Arial,Helvetica,sans-serif;font-size:25px;line-height:32px;color:#20231d;font-weight:700;">Profil approuvé ✓</td></tr><tr><td style="padding-top:0;padding-right:32px;padding-bottom:20px;padding-left:32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#686d64;">Bonjour ' || safe_name || ', votre profil professionnel a été approuvé par Zuelen. Si votre abonnement est éligible, il est maintenant visible dans l’annuaire.</td></tr><tr><td style="padding-top:0;padding-right:32px;padding-bottom:28px;padding-left:32px;"><table cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#526B43" style="background-color:#526B43;border-radius:10px;"><a href="' || cta_url || '" style="display:inline-block;padding-top:12px;padding-right:18px;padding-bottom:12px;padding-left:18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#ffffff;text-decoration:none;font-weight:700;">Ouvrir mon espace professionnel</a></td></tr></table></td></tr><tr><td style="border-top:1px solid #edf0eb;padding-top:18px;padding-right:32px;padding-bottom:24px;padding-left:32px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;color:#90958c;">Zuelen · Luxembourg business, under control.</td></tr></table></td></tr></table></body></html>';
    else
      subject_line := 'Des modifications sont requises pour votre profil Zuelen';
      text_body := 'Bonjour ' || coalesce(new.full_name, '') || E',\n\nNous avons examiné votre profil professionnel Zuelen et quelques modifications sont nécessaires avant publication.\n\nNote de vérification : ' || coalesce(new.rejection_reason, '') || E'\n\nMettre à jour mon profil : ' || cta_url || E'\n\n— L’équipe Zuelen';
      html_body := '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"></head><body style="margin:0;background-color:#f7f8f5;font-family:Arial,Helvetica,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f8f5"><tr><td align="center" style="padding-top:36px;padding-right:18px;padding-bottom:36px;padding-left:18px;"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #dfe4dc;border-radius:18px;"><tr><td style="padding-top:30px;padding-right:32px;padding-bottom:12px;padding-left:32px;"><img src="https://zuelen.lu/zuelen-icon.png" width="42" height="42" border="0" alt="Zuelen" style="display:block;width:42px;height:42px;"></td></tr><tr><td style="padding-top:12px;padding-right:32px;padding-bottom:8px;padding-left:32px;font-family:Arial,Helvetica,sans-serif;font-size:25px;line-height:32px;color:#20231d;font-weight:700;">Quelques modifications sont nécessaires</td></tr><tr><td style="padding-top:0;padding-right:32px;padding-bottom:14px;padding-left:32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#686d64;">Bonjour ' || safe_name || ', nous avons examiné votre profil professionnel. Veuillez effectuer les modifications ci-dessous avant publication.</td></tr><tr><td style="padding-top:0;padding-right:32px;padding-bottom:20px;padding-left:32px;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#F1F5ED" style="background-color:#F1F5ED;border-radius:10px;padding-top:14px;padding-right:16px;padding-bottom:14px;padding-left:16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#3F5634;">' || safe_reason || '</td></tr></table></td></tr><tr><td style="padding-top:0;padding-right:32px;padding-bottom:28px;padding-left:32px;"><table cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#526B43" style="background-color:#526B43;border-radius:10px;"><a href="' || cta_url || '" style="display:inline-block;padding-top:12px;padding-right:18px;padding-bottom:12px;padding-left:18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#ffffff;text-decoration:none;font-weight:700;">Mettre à jour mon profil</a></td></tr></table></td></tr><tr><td style="border-top:1px solid #edf0eb;padding-top:18px;padding-right:32px;padding-bottom:24px;padding-left:32px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;color:#90958c;">Zuelen · Luxembourg business, under control.</td></tr></table></td></tr></table></body></html>';
    end if;
  else
    if new.approval_status = 'approved' then
      subject_line := 'Your Zuelen professional profile is approved';
      text_body := 'Hi ' || coalesce(new.full_name, '') || E',\n\nGood news — your Zuelen professional profile has been approved. If your subscription is eligible, your listing is now visible in the directory.\n\nOpen professional workspace: ' || cta_url || E'\n\n— The Zuelen team';
      html_body := '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"></head><body style="margin:0;background-color:#f7f8f5;font-family:Arial,Helvetica,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f8f5"><tr><td align="center" style="padding-top:36px;padding-right:18px;padding-bottom:36px;padding-left:18px;"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #dfe4dc;border-radius:18px;"><tr><td style="padding-top:30px;padding-right:32px;padding-bottom:12px;padding-left:32px;"><img src="https://zuelen.lu/zuelen-icon.png" width="42" height="42" border="0" alt="Zuelen" style="display:block;width:42px;height:42px;"></td></tr><tr><td style="padding-top:12px;padding-right:32px;padding-bottom:8px;padding-left:32px;font-family:Arial,Helvetica,sans-serif;font-size:25px;line-height:32px;color:#20231d;font-weight:700;">Profile approved ✓</td></tr><tr><td style="padding-top:0;padding-right:32px;padding-bottom:20px;padding-left:32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#686d64;">Hi ' || safe_name || ', your professional profile has been approved by Zuelen. If your subscription is eligible, it is now visible in the directory.</td></tr><tr><td style="padding-top:0;padding-right:32px;padding-bottom:28px;padding-left:32px;"><table cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#526B43" style="background-color:#526B43;border-radius:10px;"><a href="' || cta_url || '" style="display:inline-block;padding-top:12px;padding-right:18px;padding-bottom:12px;padding-left:18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#ffffff;text-decoration:none;font-weight:700;">Open professional workspace</a></td></tr></table></td></tr><tr><td style="border-top:1px solid #edf0eb;padding-top:18px;padding-right:32px;padding-bottom:24px;padding-left:32px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;color:#90958c;">Zuelen · Luxembourg business, under control.</td></tr></table></td></tr></table></body></html>';
    else
      subject_line := 'Changes are required for your Zuelen profile';
      text_body := 'Hi ' || coalesce(new.full_name, '') || E',\n\nWe reviewed your Zuelen professional profile and need a few changes before it can be published.\n\nReview note: ' || coalesce(new.rejection_reason, '') || E'\n\nUpdate my profile: ' || cta_url || E'\n\n— The Zuelen team';
      html_body := '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"></head><body style="margin:0;background-color:#f7f8f5;font-family:Arial,Helvetica,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7f8f5"><tr><td align="center" style="padding-top:36px;padding-right:18px;padding-bottom:36px;padding-left:18px;"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #dfe4dc;border-radius:18px;"><tr><td style="padding-top:30px;padding-right:32px;padding-bottom:12px;padding-left:32px;"><img src="https://zuelen.lu/zuelen-icon.png" width="42" height="42" border="0" alt="Zuelen" style="display:block;width:42px;height:42px;"></td></tr><tr><td style="padding-top:12px;padding-right:32px;padding-bottom:8px;padding-left:32px;font-family:Arial,Helvetica,sans-serif;font-size:25px;line-height:32px;color:#20231d;font-weight:700;">Your profile needs a few changes</td></tr><tr><td style="padding-top:0;padding-right:32px;padding-bottom:14px;padding-left:32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#686d64;">Hi ' || safe_name || ', we reviewed your professional profile. Please make the change below before it can be published.</td></tr><tr><td style="padding-top:0;padding-right:32px;padding-bottom:20px;padding-left:32px;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#F1F5ED" style="background-color:#F1F5ED;border-radius:10px;padding-top:14px;padding-right:16px;padding-bottom:14px;padding-left:16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#3F5634;">' || safe_reason || '</td></tr></table></td></tr><tr><td style="padding-top:0;padding-right:32px;padding-bottom:28px;padding-left:32px;"><table cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#526B43" style="background-color:#526B43;border-radius:10px;"><a href="' || cta_url || '" style="display:inline-block;padding-top:12px;padding-right:18px;padding-bottom:12px;padding-left:18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;color:#ffffff;text-decoration:none;font-weight:700;">Update my profile</a></td></tr></table></td></tr><tr><td style="border-top:1px solid #edf0eb;padding-top:18px;padding-right:32px;padding-bottom:24px;padding-left:32px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;color:#90958c;">Zuelen · Luxembourg business, under control.</td></tr></table></td></tr></table></body></html>';
    end if;
  end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || resend_key,
      'Idempotency-Key', md5(new.id::text || ':' || new.approval_status || ':' || coalesce(new.updated_at::text, now()::text))
    ),
    body := jsonb_build_object(
      'from','Zuelen <notifications@zuelen.lu>',
      'to',jsonb_build_array(recipient_email),
      'subject',subject_line,
      'text',text_body,
      'html',html_body
    ),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  raise warning 'Zuelen accountant review notification failed: %', sqlerrm;
  return new;
end;
$$;

revoke all on function app_private.notify_accountant_review_decision() from public, anon, authenticated;

drop trigger if exists accountant_review_decision_email on public.accountant_profiles;
create trigger accountant_review_decision_email
after update of approval_status on public.accountant_profiles
for each row
when (old.approval_status is distinct from new.approval_status)
execute function app_private.notify_accountant_review_decision();
