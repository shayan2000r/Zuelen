-- Minimal fixtures for the SQL regression tests on a fresh local database:
-- two users, each owning one company workspace created through the application RPC.
\set ON_ERROR_STOP on
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-0000000000f1', 'fixture-1@example.test', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-0000000000f2', 'fixture-2@example.test', 'authenticated', 'authenticated')
on conflict do nothing;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
set role authenticated;
select public.create_company_workspace_v2('Fixture One SARL', 'fixture-one', 'SARL', 'B100001', 'LU10000001', 'Luxembourg', true, null,
  '{"street":"1 rue Fixture","postal_code":"L-1111","city":"Luxembourg","country":"LU"}');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false);
set role authenticated;
select public.create_company_workspace_v2('Fixture Two SA', 'fixture-two', 'SA', 'B100002', 'LU10000002', 'Luxembourg', true, null,
  '{"street":"2 rue Fixture","postal_code":"L-1111","city":"Luxembourg","country":"LU"}');
reset role;
select set_config('request.jwt.claim.sub', '', false);
