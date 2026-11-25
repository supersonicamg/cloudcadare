-- =============================================================================
-- 00_foundation.sql
-- Extensions, schemas, shared helper functions.
--
-- Target  : Supabase Postgres 17+
-- Apply   : files in numeric order (00 → 99). Each file is one migration.
-- Schemas :
--   control  – CONTROL PLANE (distributors, plans, features, licenses, tenants).
--              Never exposed through the Supabase Data API. Accessed only by
--              server code (console app / workers) using the secret key.
--   public   – DATA PLANE (everything an academy owns). Exposed through the Data
--              API, protected by RLS + explicit grants (see 95_rls_policies.sql).
--   private  – helper functions & internal lookup tables. Not exposed.
-- =============================================================================

create extension if not exists citext   with schema extensions;
create extension if not exists pg_trgm  with schema extensions;
-- Enable these from the Supabase dashboard / config.toml (they are referenced
-- by jobs, not by DDL here): pg_cron, pgmq (Supabase Queues), supabase_vault, pg_net.

create schema if not exists private;
create schema if not exists control;

revoke all on schema private from public, anon, authenticated;
revoke all on schema control from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;  -- RLS policies call private.* helpers
grant usage on schema control to service_role;

-- Supabase grants anon/authenticated full access to new objects in public by
-- default. We flip that: nothing is reachable unless explicitly granted.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;
-- Per-schema default privileges can only ADD to the global defaults, so remove
-- PostgreSQL's built-in "EXECUTE to PUBLIC" globally: every function must be granted explicitly.
alter default privileges revoke execute on functions from public;

-- -----------------------------------------------------------------------------
-- UUIDv7: time-ordered UUIDs. Index-friendly (append-mostly B-trees), globally
-- unique (tenants can be moved between data planes without key collisions),
-- and leak no row counts (unlike serials). Replace with native uuidv7() on PG18.
-- -----------------------------------------------------------------------------
create or replace function private.uuid7()
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  b  bytea  := uuid_send(gen_random_uuid());
begin
  b := set_byte(b, 0, ((ms >> 40) & 255)::int);
  b := set_byte(b, 1, ((ms >> 32) & 255)::int);
  b := set_byte(b, 2, ((ms >> 24) & 255)::int);
  b := set_byte(b, 3, ((ms >> 16) & 255)::int);
  b := set_byte(b, 4, ((ms >>  8) & 255)::int);
  b := set_byte(b, 5, ( ms        & 255)::int);
  b := set_byte(b, 6, (get_byte(b, 6) & 15) | 112);   -- version 7
  b := set_byte(b, 8, (get_byte(b, 8) & 63) | 128);   -- RFC 4122 variant
  return encode(b, 'hex')::uuid;
end
$$;
grant execute on function private.uuid7() to authenticated, service_role;

-- updated_at maintenance (attached to every table with updated_at in 99_seed_catalog.sql)
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- -----------------------------------------------------------------------------
-- Monthly range partitions for high-volume append-only tables.
-- Scheduled daily by pg_cron:  select private.ensure_monthly_partitions('public.learning_events', 3);
-- (pg_partman is an alternative; this keeps zero extra dependencies.)
-- -----------------------------------------------------------------------------
create or replace function private.ensure_monthly_partitions(p_parent regclass, p_months_ahead int default 3)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_schema text;
  v_table  text;
  v_start  date := date_trunc('month', now() - interval '1 month')::date;
  v_from   date;
  v_to     date;
  v_name   text;
begin
  select n.nspname, c.relname into v_schema, v_table
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.oid = p_parent;

  for i in 0 .. p_months_ahead + 1 loop
    v_from := (v_start + make_interval(months => i))::date;
    v_to   := (v_from  + interval '1 month')::date;
    v_name := format('%s_%s', v_table, to_char(v_from, 'YYYYMM'));
    if to_regclass(format('%I.%I', v_schema, v_name)) is null then
      execute format('create table %I.%I partition of %I.%I for values from (%L) to (%L)',
                     v_schema, v_name, v_schema, v_table, v_from, v_to);
    end if;
  end loop;
end
$$;
