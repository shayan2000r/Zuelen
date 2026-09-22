-- Convert RCS / business-permit invoice issuance checks from hard blockers
-- into UI compliance warnings. This migration follows
-- 20260922105445_fix_independent_invoice_registration_requirements.sql.

DO $migration$
DECLARE
  ddl text;
BEGIN
  SELECT pg_get_functiondef('public.issue_service_invoice_draft(uuid)'::regprocedure) INTO ddl;

  IF position('v_independent_rcs_registered' in ddl) = 0 THEN
    RAISE EXCEPTION 'Expected independent invoice registration logic was not found';
  END IF;

  ddl := replace(ddl,
E'  v_independent_rcs_registered boolean := false;\n  v_independent_permit_held boolean := false;\n',
'');

  ddl := replace(ddl,
E'  if v_company.entity_kind = ''independent'' then\n    select\n      coalesce(iap.rcs_registered, false),\n      coalesce(iap.business_permit_held, false)\n    into\n      v_independent_rcs_registered,\n      v_independent_permit_held\n    from public.independent_activity_profiles iap\n    where iap.company_id = v_company.id;\n\n    v_independent_rcs_registered := coalesce(v_independent_rcs_registered, false);\n    v_independent_permit_held := coalesce(v_independent_permit_held, false);\n  end if;\n\n',
'');

  ddl := replace(ddl,
E'  if (\n    v_company.entity_kind <> ''independent''\n    or v_independent_rcs_registered\n  ) and nullif(trim(v_company.rcs_number),'''') is null then\n    raise exception ''Complete the RCS number before issuing an invoice'';\n  end if;\n\n  if (\n    v_company.entity_kind <> ''independent''\n    or v_independent_permit_held\n  ) and nullif(trim(v_company.business_permit_number),'''') is null then\n    raise exception ''Complete the business permit number before issuing an invoice'';\n  end if;\n\n',
'');

  EXECUTE ddl;

  SELECT pg_get_functiondef('public.create_and_issue_service_invoice(uuid,text,text,text,text,jsonb,date,date,date,text,jsonb,text)'::regprocedure) INTO ddl;

  ddl := replace(
    ddl,
    E'  if nullif(trim(v_company.rcs_number),'''') is null then raise exception ''Complete the company RCS number before issuing an invoice''; end if;\n',
    ''
  );
  ddl := replace(
    ddl,
    E'  if nullif(trim(v_company.business_permit_number),'''') is null then raise exception ''Complete the business permit number before issuing an invoice''; end if;\n',
    ''
  );

  EXECUTE ddl;
END;
$migration$;
