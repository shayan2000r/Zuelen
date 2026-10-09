-- Keep the compliance authority contract aligned with every supported Luxembourg authority.
-- CCSS obligations are created during Independent workspace onboarding.
alter table public.compliance_obligations
  drop constraint if exists compliance_obligations_authority_check;

alter table public.compliance_obligations
  add constraint compliance_obligations_authority_check
  check (authority in ('AED', 'ACD', 'LBR', 'RCS', 'RBE', 'ECDF', 'CCSS', 'OTHER'))
  not valid;

alter table public.compliance_obligations
  validate constraint compliance_obligations_authority_check;
