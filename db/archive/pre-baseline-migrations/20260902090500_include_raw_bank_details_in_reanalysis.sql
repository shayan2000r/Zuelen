-- POST and other statement formats sometimes keep the semantic movement label
-- (for example "Remb. paiement electronique") in raw_details rather than communication.
-- Include it when re-running deterministic classification so refund/tax safety rules can see it.

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
    nullif(v_raw->>'raw_details',''),
    nullif(v_raw->>'counterparty_address',''),
    nullif(v_raw->>'counterparty_iban','')
  );

  select * into v_s
  from app_private.suggest_bank_account(v_tx.company_id, v_tx.direction, v_tx.counterparty_name, v_context);

  v_protected := coalesce(v_s.kind,'') in (
    'shareholder_transfer','tax_advance','tax_payment','payment_processor_fee',
    'refund_candidate','penalty','registry_payment','bank_transfer_unknown'
  );

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
