-- Establishment-authorisation barcode on invoices (regulatory register G5)
--
-- Ministry of the Economy, "Autorisation d'établissement" (05/2025): a two-dimensional barcode is
-- attributed to each establishment authorisation and must appear on letters, e-mails, websites,
-- quotes, invoices and shop fronts. The business uploads the barcode it received; it is frozen into
-- the issuer snapshot when an invoice is issued, so later changes do not alter issued invoices.

alter table public.companies add column if not exists establishment_barcode_path text;
comment on column public.companies.establishment_barcode_path is
  'Storage path (bucket company-documents) of the 2D barcode of the establishment authorisation, printed on invoices.';

create or replace function app_private.sales_invoice_issue_checks()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public', 'app_private'
as $$
declare
  v_company public.companies%rowtype;
  v_bad_rate numeric;
begin
  if new.status <> 'draft' and (tg_op = 'INSERT' or old.status = 'draft') then
    select l.vat_rate into v_bad_rate from public.sales_invoice_lines l
    where l.invoice_id = new.id and not public.lu_vat_rate_allowed(l.vat_rate, new.service_date) limit 1;
    if found then
      raise exception 'Unsupported Luxembourg VAT rate % for a supply on %', v_bad_rate, new.service_date;
    end if;

    select * into v_company from public.companies where id = new.company_id;
    new.vat_exemption_mention := case
      when new.vat_treatment = 'eu_b2b_reverse_charge' then 'Autoliquidation'
      when new.vat_treatment = 'domestic' and new.vat_total = 0 and v_company.vat_exemption_basis = 'exempt_activity'
        then 'Exonération de TVA – article 44 de la loi modifiée du 12 février 1979'
      when new.vat_treatment = 'domestic' and new.vat_total = 0 and (v_company.vat_exemption_basis = 'franchise' or not v_company.vat_registered)
        then 'TVA non applicable – Article 57bis de la loi modifiée du 12 février 1979'
      else null end;

    -- Freeze the establishment-authorisation barcode shown on the issued invoice.
    if v_company.establishment_barcode_path is not null then
      new.issuer_snapshot := coalesce(new.issuer_snapshot, '{}'::jsonb)
        || jsonb_build_object('establishment_barcode_path', v_company.establishment_barcode_path);
    end if;
  end if;
  return new;
end $$;

revoke all on function app_private.sales_invoice_issue_checks() from public, anon;
