-- Fingerprint of the public and app_private schemas. Run on production and on a database built
-- from db/baseline + db/migrations: every row must match.
with s as (select unnest(array['public','app_private']) as nsp)
select 'tables' as item, count(*)::text as value
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in (select nsp from s) and c.relkind = 'r'
union all
select 'columns', md5(string_agg(c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull || ':' || coalesce(pg_get_expr(d.adbin, d.adrelid), ''), '|' order by c.relname, a.attname))
  from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where n.nspname in (select nsp from s) and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
union all
select 'constraints', md5(string_agg(conrelid::regclass || ':' || conname || ':' || pg_get_constraintdef(oid), '|' order by conrelid::regclass::text, conname))
  from pg_constraint where connamespace in (select oid from pg_namespace where nspname in (select nsp from s))
union all
select 'indexes', md5(string_agg(indexdef, '|' order by tablename, indexname))
  from pg_indexes where schemaname in (select nsp from s)
union all
select 'functions', count(*)::text || ':' || md5(string_agg(p.oid::regprocedure::text || ':' || md5(pg_get_functiondef(p.oid)), '|' order by p.oid::regprocedure::text))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in (select nsp from s) and p.prokind in ('f','p') and p.proname <> 'zz_tmp_schema_export'
union all
select 'policies', count(*)::text || ':' || md5(string_agg(schemaname || tablename || policyname || permissive || cmd || roles::text || coalesce(qual, '') || coalesce(with_check, ''), '|' order by schemaname, tablename, policyname))
  from pg_policies where schemaname in ('public','app_private','storage')
union all
select 'triggers', md5(string_agg(pg_get_triggerdef(t.oid), '|' order by t.tgrelid::regclass::text, t.tgname))
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal and n.nspname in (select nsp from s)
union all
select 'table_grants', md5(string_agg(c.oid::regclass || ':' || a.privilege_type || ':' || a.grantee::regrole, '|' order by c.oid::regclass::text, a.privilege_type, a.grantee::regrole::text))
  from pg_class c join pg_namespace n on n.oid = c.relnamespace cross join lateral aclexplode(c.relacl) a
  where n.nspname in (select nsp from s) and c.relkind = 'r' and a.grantee <> c.relowner and a.grantee <> 0
union all
select 'function_grants', md5(string_agg(p.oid::regprocedure || ':' || coalesce(a.grantee::regrole::text, 'public'), '|' order by p.oid::regprocedure::text, a.grantee::regrole::text))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  where n.nspname in (select nsp from s) and p.proname <> 'zz_tmp_schema_export' and a.grantee <> p.proowner
union all
select 'rls_enabled', string_agg(c.relname, ',' order by c.relname) filter (where not c.relrowsecurity)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in (select nsp from s) and c.relkind = 'r'
union all
select 'pcn_accounts', count(*)::text || ':' || md5(string_agg(code || label_fr || coalesce(label_en, '') || account_type, '|' order by code)) from public.pcn_accounts
union all
select 'pcn_groups', count(*)::text from public.pcn_account_groups
union all
select 'compliance_rules', count(*)::text from public.compliance_rules
union all
select 'ccss_periods', md5(string_agg(effective_from::text || dependency_allowance::text || ssm::text, '|' order by effective_from)) from public.ccss_parameter_periods
order by 1;
