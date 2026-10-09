-- Keep shareholder current-account movements on one running ledger during the year.
-- PCN 4712 is used for explicit shareholder-current-account bank movements; any debit
-- balance can be reclassified to PCN 4212 for balance-sheet presentation when required.

create or replace function app_private.suggest_bank_account(
  p_company_id uuid,
  p_direction text,
  p_counterparty text,
  p_description text
)
returns table(account_id uuid, confidence numeric, reason text, kind text)
language plpgsql
stable
set search_path to 'pg_catalog','public','app_private'
as $function$
declare
  v_text text;
  v_code text;
  v_conf numeric;
  v_reason text;
  v_kind text := 'operating';
begin
  v_text := translate(lower(coalesce(p_counterparty,'') || ' ' || coalesce(p_description,'')), 'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy');

  if v_text like '%compte courant associ%' or v_text like '%apport associ%' then
    v_code := '4712';
    v_conf := 0.95;
    v_kind := 'shareholder_transfer';
    v_reason := case
      when p_direction='income' then 'Shareholder funding entered the company. Record it on the shareholder current account; any debit balance is reclassified to a shareholder receivable for balance-sheet presentation.'
      else 'Company money was paid to the shareholder. Record it on the shareholder current account; any debit balance is reclassified to a shareholder receivable for balance-sheet presentation.'
    end;
  elsif p_direction='income' and (v_text like '%remb%paiement%electron%' or v_text like '%payment%refund%' or v_text like '%card%refund%' or v_text like '%rembours%carte%') then
    v_code:=null; v_conf:=0.86; v_kind:='refund_candidate'; v_reason:='Incoming card/payment refund detected. Match it to the original purchase category instead of treating it as new revenue.';
  elsif p_direction='expense' and (v_text like '%upwrkescrow%' or v_text like '%upwork%escrow%' or v_text like '%upwork%') then
    v_code:='61348'; v_conf:=case when v_text like '%upwrkescrow%' or v_text like '%connect%' then 0.95 else 0.93 end; v_reason:='Upwork platform/escrow charge detected; suggested as a professional platform fee.';
  elsif p_direction='income' and (v_text like '%upwork%' or v_text like '%payment escrow inc%') then
    v_code:='7033'; v_conf:=0.97; v_reason:='Upwork/platform service payout detected; suggested as service revenue.';
  elsif p_direction='income' and v_text like '%wolt%luxembourg%' then
    v_code:='7033'; v_conf:=0.98; v_reason:='Wolt business payout detected; suggested as service revenue.';
  elsif p_direction='income' and ((v_text like '%wix.com ltd%' or v_text like '%wix com ltd%') or (v_text like '%wix%' and v_text like '%reiclien%')) then
    v_code:='7033'; v_conf:=0.96; v_reason:='Wix partner/revenue payout detected; suggested as service revenue rather than an expense refund.';
  elsif p_direction='expense' and (v_text like '%google%ads%' or v_text like '%google ads%' or v_text like '%facebook%' or v_text like '%facebk%' or v_text like '%fb.me/ads%' or v_text like '%meta%ads%' or v_text like '%reddit%ads%') then
    v_code:='6151'; v_conf:=0.96; v_reason:='Advertising platform charge detected; suggested as marketing/advertising.';
  elsif p_direction='expense' and (v_text like '%zsfrspb1%' or v_text like '%zsfrsao3%' or v_text like '%forfait mensuel pack pro%' or v_text like '%forfait mensuel%pack%' or v_text like '%monthly%account%package%') then
    v_code:='61333'; v_conf:=0.96; v_kind:='bank_fee'; v_reason:='Recurring bank account/package fee detected; suggested as bank account charges and commissions.';
  elsif p_direction='expense' and v_text like '%stripe%' then
    v_code:='61334'; v_conf:=0.94; v_kind:='payment_processor_fee'; v_reason:='Stripe debit/processing fee detected; suggested as charges for electronic means of payment.';
  elsif p_direction='expense' and v_text like '%luxtrust%' then
    v_code:='6132'; v_conf:=0.90; v_reason:='LuxTrust digital identity/certificate service detected; suggested as IT services.';
  elsif p_direction='expense' and (v_text like '%adobe%' or v_text like '%canva%' or v_text like '%openai%' or v_text like '%chatgpt%' or v_text like '%suno%' or v_text like '%anthropic%' or v_text like '%claude%' or v_text like '%clickup%' or v_text like '%wix.com%' or v_text like '%hostinger%' or v_text like '%magnific%' or v_text like '%microsoft%' or v_text like '%google workspace%' or v_text like '%google one%' or v_text like '%apple.com/bill%' or v_text like '%itunes%' or v_text like '%distrokid%' or v_text like '%envato%' or v_text like '%tidio%' or v_text like '%elfsight%' or v_text like '%resume.io%' or v_text like '%resume io%' or v_text like '%ui8.net%' or v_text like '%ui8 net%') then
    v_code:='6132'; v_conf:=case when v_text like '%apple.com/bill%' or v_text like '%itunes%' then 0.76 else 0.92 end; v_reason:='Digital software/subscription/design-service provider detected; suggested as IT services. Review business purpose for generic consumer-platform charges.';
  elsif p_direction='income' and (v_text like '%stripe technology europe%' or v_text like '%stripe technology%') then
    v_code:='7033'; v_conf:=0.69; v_kind:='platform_payout'; v_reason:='Stripe payout detected. Revenue is likely, but a payout can aggregate sales, fees and VAT and may need matching to invoices or Stripe evidence.';
  elsif p_direction='expense' and (v_text like '%acd-%' or v_text like '%administration des contributions%' or v_text like '%recette esch%') and (v_text like '%avance%' or v_text like '%acompte%' or v_text like '%quarter%') then
    v_code:='42148'; v_conf:=0.90; v_kind:='tax_advance'; v_reason:='ACD tax advance detected. Kept as an ACD tax prepayment/receivable until the notice identifies IRC, ICC, IF or another specific tax; no ordinary operating expense is created.';
  elsif p_direction='expense' and (v_text like '%acd-%' or v_text like '%administration des contributions%' or v_text like '%recette esch%') then
    v_code:='42148'; v_conf:=0.82; v_kind:='tax_payment'; v_reason:='Payment to the ACD detected. Kept temporarily as an ACD tax prepayment until it is matched to the relevant tax notice and exact tax liability.';
  elsif (v_text like '%luxembourg business regis%' or v_text like '%registre de commerce%') and (v_text like '%late%' or v_text like '%retard%' or v_text like '%penal%' or v_text like '%majoration%') then
    v_code:='6481'; v_conf:=0.91; v_kind:='penalty'; v_reason:='RCS/LBR late-payment penalty detected; suggested as fines, sanctions and penalties.';
  elsif v_text like '%luxembourg business regis%' or v_text like '%registre de commerce%' then
    v_code:=null; v_conf:=0.64; v_kind:='registry_payment'; v_reason:='LBR/RCS payment detected. Confirm whether this is a normal filing/administrative charge or a late penalty before posting.';
  elsif v_text like '%pgctstdb%' or v_text like '%zob2bdb%' or v_text like '%pgctstcr%' or v_text like '%zob2bcr%' then
    v_code:=null; v_conf:=null; v_kind:='bank_transfer_unknown'; v_reason:='Bank-transfer operation detected, but the statement contains no reliable beneficiary/sender description. Zuelen will not guess the accounting account from the amount alone.';
  else
    v_code:=null; v_conf:=null; v_reason:=null; v_kind:=null;
  end if;

  if v_code is null then
    account_id:=null; confidence:=v_conf; reason:=v_reason; kind:=v_kind; return next; return;
  end if;

  select ca.id into account_id
  from public.company_accounts ca
  where ca.company_id=p_company_id and ca.code=v_code and ca.is_active=true
  limit 1;

  confidence:=v_conf; reason:=v_reason; kind:=v_kind; return next;
end
$function$;
