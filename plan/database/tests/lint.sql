-- =============================================================================
-- tests/lint.sql — schema lints. Every query must return ZERO rows (CI gate).
-- Mirrors the Supabase database advisor checks we care most about.
-- =============================================================================
\set ON_ERROR_STOP 1

\echo '1. tables without RLS (public, control)'
select n.nspname || '.' || c.relname as table_without_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p') and n.nspname in ('public', 'control') and not c.relrowsecurity;

\echo '2. functions without a pinned search_path'
select n.nspname || '.' || p.proname as fn_without_search_path
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private', 'control') and p.prokind = 'f'
  and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'));

\echo '3. views that are not security_invoker'
select n.nspname || '.' || c.relname as definer_view
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'v' and n.nspname = 'public'
  and not coalesce(c.reloptions::text like '%security_invoker=true%', false);

\echo '4. anything granted to anon'
select table_schema || '.' || table_name || ':' || privilege_type as anon_grant
from information_schema.role_table_grants where grantee = 'anon' and table_schema in ('public', 'control');

\echo '5. SECURITY DEFINER functions executable by anon'
select p.oid::regprocedure as anon_executable_definer
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private', 'control') and p.prosecdef and has_function_privilege('anon', p.oid, 'execute');

\echo '6. foreign keys without a usable index'
with fk as (
  select c.conrelid, c.conname,
         (select a.attnum from pg_attribute a
           where a.attrelid = c.conrelid and a.attnum = any (c.conkey) and a.attname <> 'tenant_id'
           order by a.attnum limit 1) as selcol
  from pg_constraint c join pg_namespace n on n.oid = c.connamespace
  where c.contype = 'f' and n.nspname in ('public', 'control')
)
select fk.conrelid::regclass || ' / ' || fk.conname as unindexed_fk
from fk
where fk.selcol is not null
  and not exists (
    select 1 from pg_index i
    where i.indrelid = fk.conrelid
      and (i.indkey[0] = fk.selcol
           or (i.indkey[0] = (select attnum from pg_attribute where attrelid = fk.conrelid and attname = 'tenant_id')
               and i.indkey[1] = fk.selcol)));

\echo '7. data-plane tables missing tenant_id (excluding global catalogs)'
select c.relname as table_without_tenant_id
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relispartition
  and c.relname not in ('tenants', 'permission_catalog')
  and not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped);
