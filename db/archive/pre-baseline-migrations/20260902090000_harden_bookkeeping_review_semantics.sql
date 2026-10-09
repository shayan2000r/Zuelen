-- Make non-expert transaction review safer before further bank-statement imports.
-- 1) Existing workspaces receive the same active PCN2020 account catalogue as newly created workspaces.
-- 2) Deterministic semantic rules protect shareholder transfers, tax advances, refunds and payment fees from learned mistakes.
-- 3) Stripe processing fees use the dedicated electronic-payment-fee account.
-- 4) ACD advances stay on the balance sheet until the specific tax notice is known.

insert into public.company_accounts (
  organization_id, company_id, pcn_account_id, code, label, label_en, label_fr, account_type, is_active
)
select
  c.organization_id,
  c.id,
  p.id,
  p.code,
  coalesce(p.label_en, p.label_fr),
  p.label_en,
  p.label_fr,
  p.account_type,
  true
from public.companies c
cross join public.pcn_accounts p
where p.source_version = 'PCN2020'
  and p.is_active = true
on conflict (company_id, code) do nothing;

create or replace function app_private.suggest_bank_account(
  p_company_id uuid,
  p_direction text,
  p_counterparty text,
  p_description text
)
returns table(account_id uuid, confidence numeric, reason text, kind text)
language plpgsql
stable
set search_path to 'pg_catalog', 'public', 'app_private'
as $function$
declare
  v_text text;
  v_code text;
  v_conf numeric;
  v_reason text;
  v_kind text := 'operating';
begin
  v_text := lower(coalesce(p_counterparty,'') || ' ' || coalesce(p_description,''));

  if v_text like '%compte courant associ%' or v_text like '%apport associ%' then
    v_code := '4712';
    v_conf := 0.94;
    v_kind := 'shareholder_transfer';
    v_reason := case
      when p_direction = 'income' then 'Shareholder money entered the company. This normally increases the amount the company owes the shareholder (current account).'
      else 'The company paid the shareholder. This normally reduces the existing shareholder current-account balance; use a shareholder receivable only if the shareholder truly owes the company.'
    end;

  elsif p_direction = 'income' and (
      v_text like '%remb%paiement%electron%'
      or v_text like '%payment%refund%'
      or v_text like '%card%refund%'
      or v_text like '%rembours%carte%'
    ) then
    v_code := null;
    v_conf := 0.86;
    v_kind := 'refund_candidate';
    v_reason := 'Incoming card/payment refund detected. Match it to the original purchase category instead of treating it as new revenue.';

  elsif p_direction = 'expense' and (v_text like '%upwrkescrow%' or v_text like '%upwork%escrow%' or v_text like '%upwork%') then
    v_code := '61348';
    v_conf := case when v_text like '%upwrkescrow%' or v_text like '%connect%' then 0.95 else 0.93 end;
    v_reason := 'Upwork platform/escrow charge detected; suggested as a professional platform fee.';

  elsif p_direction = 'income' and (v_text like '%upwork%' or v_text like '%payment escrow inc%') then
    v_code := '7033';
    v_conf := 0.97;
    v_reason := 'Upwork/platform service payout detected; suggested as service revenue.';

  elsif p_direction = 'income' and v_text like '%wolt%luxembourg%' then
    v_code := '7033';
    v_conf := 0.98;
    v_reason := 'Wolt business payout detected; suggested as service revenue.';

  elsif p_direction = 'income' and ((v_text like '%wix.com ltd%' or v_text like '%wix com ltd%') or (v_text like '%wix%' and v_text like '%reiclien%')) then
    v_code := '7033';
    v_conf := 0.96;
    v_reason := 'Wix partner/revenue payout detected; suggested as service revenue rather than an expense refund.';

  elsif p_direction = 'expense' and (
      v_text like '%google%ads%' or v_text like '%google ads%' or
      v_text like '%facebook%' or v_text like '%facebk%' or v_text like '%fb.me/ads%' or
      v_text like '%meta%ads%' or v_text like '%reddit%ads%'
    ) then
    v_code := '6151';
    v_conf := 0.96;
    v_reason := 'Advertising platform charge detected; suggested as marketing/advertising.';

  elsif p_direction = 'expense' and (v_text like '%zsfrspb1%' or v_text like '%zsfrsao3%') then
    v_code := '61333';
    v_conf := 0.96;
    v_kind := 'bank_fee';
    v_reason := 'Recurring bank service-fee operation code detected; suggested as bank charges and commissions.';

  elsif p_direction = 'expense' and v_text like '%stripe%' then
    v_code := '61334';
    v_conf := 0.94;
    v_kind := 'payment_processor_fee';
    v_reason := 'Stripe debit/processing fee detected; suggested as charges for electronic means of payment.';

  elsif p_direction = 'expense' and v_text like '%luxtrust%' then
    v_code := '6132';
    v_conf := 0.90;
    v_reason := 'LuxTrust digital identity/certificate service detected; suggested as IT services.';

  elsif p_direction = 'expense' and (
      v_text like '%adobe%' or v_text like '%canva%' or v_text like '%openai%' or v_text like '%chatgpt%' or
      v_text like '%suno%' or v_text like '%anthropic%' or v_text like '%claude%' or v_text like '%clickup%' or
      v_text like '%wix.com%' or v_text like '%hostinger%' or v_text like '%magnific%' or v_text like '%microsoft%' or
      v_text like '%google workspace%' or v_text like '%google one%' or v_text like '%apple.com/bill%' or v_text like '%itunes%' or
      v_text like '%distrokid%' or v_text like '%envato%' or v_text like '%tidio%' or v_text like '%elfsight%' or
      v_text like '%resume.io%' or v_text like '%resume io%' or v_text like '%ui8.net%' or v_text like '%ui8 net%'
    ) then
    v_code := '6132';
    v_conf := case when v_text like '%apple.com/bill%' or v_text like '%itunes%' then 0.76 else 0.92 end;
    v_reason := 'Digital software/subscription/design-service provider detected; suggested as IT services. Review business purpose for generic consumer-platform charges.';

  elsif p_direction = 'income' and (v_text like '%stripe technology europe%' or v_text like '%stripe technology%') then
    v_code := '7033';
    v_conf := 0.69;
    v_kind := 'platform_payout';
    v_reason := 'Stripe payout detected. Revenue is likely, but a payout can aggregate sales, fees and VAT and may need matching to invoices or Stripe evidence.';

  elsif p_direction = 'expense' and
        (v_text like '%acd-%' or v_text like '%administration des contributions%' or v_text like '%recette esch%') and
        (v_text like '%avance%' or v_text like '%acompte%' or v_text like '%quarter%') then
    v_code := '42148';
    v_conf := 0.90;
    v_kind := 'tax_advance';
    v_reason := 'ACD tax advance detected. Kept as an ACD tax prepayment/receivable until the notice identifies IRC, ICC, IF or another specific tax; no ordinary operating expense is created.';

  elsif p_direction = 'expense' and (v_text like '%acd-%' or v_text like '%administration des contributions%' or v_text like '%recette esch%') then
    v_code := '46128';
    v_conf := 0.78;
    v_kind := 'tax_payment';
    v_reason := 'ACD payment detected. Review the tax notice before choosing a specific IRC, ICC, IF or other ACD payable.';

  elsif (v_text like '%luxembourg business regis%' or v_text like '%registre de commerce%') and (v_text like '%late%' or v_text like '%retard%' or v_text like '%penal%' or v_text like '%majoration%') then
    v_code := '6481';
    v_conf := 0.91;
    v_kind := 'penalty';
    v_reason := 'RCS/LBR late-payment penalty detected; suggested as fines, sanctions and penalties.';

  elsif v_text like '%luxembourg business regis%' or v_text like '%registre de commerce%' then
    v_code := null;
    v_conf := 0.64;
    v_kind := 'registry_payment';
    v_reason := 'LBR/RCS payment detected. Confirm whether this is a normal filing/administrative charge or a late penalty before posting.';

  elsif v_text like '%pgctstdb%' or v_text like '%zob2bdb%' or v_text like '%pgctstcr%' or v_text like '%zob2bcr%' then
    v_code := null;
    v_conf := null;
    v_kind := 'bank_transfer_unknown';
    v_reason := 'Bank-transfer operation detected, but the statement contains no reliable beneficiary/sender description. Zuelen will not guess the accounting account from the amount alone.';

  else
    v_code := null;
    v_conf := null;
    v_reason := null;
    v_kind := null;
  end if;

  if v_code is null then
    account_id := null;
    confidence := v_conf;
    reason := v_reason;
    kind := v_kind;
    return next;
    return;
  end if;

  select ca.id
  into account_id
  from public.company_accounts ca
  where ca.company_id = p_company_id
    and ca.code = v_code
    and ca.is_active = true
  limit 1;

  confidence := v_conf;
  reason := v_reason;
  kind := v_kind;
  return next;
end
$function$;

create or replace function public.apply_source_transaction_suggestion(p_source_transaction_id uuid)
returns uuid
language plpgsql
set search_path to 'pg_catalog', 'public', 'app_private'
as $function$
declare
  v_tx public.source_transactions%rowtype;
  v_s record;
  v_match record;
  v_match_count integer;
  v_rule public.classification_rules%rowtype;
  v_norm text;
  v_raw jsonb;
  v_context text;
  v_protected boolean := false;
begin
  select * into v_tx from public.source_transactions where id = p_source_transaction_id;
  if not found then raise exception 'Transaction not found'; end if;
  if not app_private.can_bookkeep_org(v_tx.organization_id) then raise exception 'Permission denied'; end if;

  if v_tx.source_type = 'bank' and v_tx.source_id is not null then
    select raw_data into v_raw from public.bank_transactions where id = v_tx.source_id;
  end if;

  v_context := concat_ws(' ',
    nullif(v_tx.description,''),
    nullif(v_raw->>'operation_code',''),
    nullif(v_raw->>'communication',''),
    nullif(v_raw->>'counterparty_address',''),
    nullif(v_raw->>'counterparty_iban','')
  );

  select * into v_s
  from app_private.suggest_bank_account(v_tx.company_id, v_tx.direction, v_tx.counterparty_name, v_context);

  v_protected := coalesce(v_s.kind,'') in (
    'shareholder_transfer','tax_advance','tax_payment','payment_processor_fee',
    'refund_candidate','penalty','registry_payment','bank_transfer_unknown'
  );

  -- Semantic safety rules outrank learned counterparty history. This prevents a non-expert
  -- confirmation from teaching Zuelen the wrong balance-sheet/tax/refund treatment forever.
  if v_protected then
    update public.source_transactions
    set suggested_account_id = v_s.account_id,
        suggestion_confidence = v_s.confidence,
        suggestion_reason = v_s.reason,
        suggestion_kind = v_s.kind,
        updated_at = now()
    where id = v_tx.id;
    return v_s.account_id;
  end if;

  v_norm := app_private.normalize_counterparty(v_tx.counterparty_name);
  if length(v_norm) >= 3 then
    select * into v_rule
    from public.classification_rules
    where company_id = v_tx.company_id
      and direction = v_tx.direction
      and normalized_counterparty = v_norm
    order by times_confirmed desc, last_used_at desc
    limit 1;

    if found then
      update public.source_transactions
      set suggested_account_id = v_rule.company_account_id,
          suggestion_confidence = least(.99,.88+(least(v_rule.times_confirmed,5)*.02)),
          suggestion_reason = 'Learned from your previous confirmed treatment for this counterparty.',
          suggestion_kind = 'learned_rule',
          vat_treatment = case when vat_treatment = 'unknown' then v_rule.vat_treatment else vat_treatment end,
          vat_rate = coalesce(vat_rate,v_rule.vat_rate),
          counterparty_country = coalesce(counterparty_country,v_rule.counterparty_country),
          updated_at = now()
      where id = v_tx.id;
      update public.classification_rules set last_used_at = now(), updated_at = now() where id = v_rule.id;
      return v_rule.company_account_id;
    end if;
  end if;

  if v_s.account_id is null and v_s.kind is null and v_tx.direction = 'income' then
    select count(*) into v_match_count
    from public.source_transactions st
    where st.company_id = v_tx.company_id
      and st.direction = 'expense'
      and st.occurred_on between (v_tx.occurred_on - 45) and v_tx.occurred_on
      and st.amount_gross = v_tx.amount_gross
      and st.suggested_account_id is not null
      and st.id <> v_tx.id;

    if v_match_count = 1 then
      select st.id, st.suggested_account_id
      into v_match.id, v_match.suggested_account_id
      from public.source_transactions st
      where st.company_id = v_tx.company_id
        and st.direction = 'expense'
        and st.occurred_on between (v_tx.occurred_on - 45) and v_tx.occurred_on
        and st.amount_gross = v_tx.amount_gross
        and st.suggested_account_id is not null
        and st.id <> v_tx.id
      limit 1;

      if v_match.suggested_account_id is not null then
        v_s.account_id := v_match.suggested_account_id;
        v_s.confidence := 0.68;
        v_s.kind := 'refund_candidate';
        v_s.reason := 'Possible supplier refund: this bank inflow exactly matches one recent expense amount. Confirm the merchant/original purchase before posting.';
      end if;
    end if;
  end if;

  update public.source_transactions
  set suggested_account_id = v_s.account_id,
      suggestion_confidence = v_s.confidence,
      suggestion_reason = v_s.reason,
      suggestion_kind = v_s.kind,
      updated_at = now()
  where id = v_tx.id;

  return v_s.account_id;
end
$function$;
