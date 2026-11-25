-- TEST HARNESS ONLY – not a migration.
-- The bare supabase/postgres image has no Storage tables (the storage-api service
-- creates them). Minimal stand-ins so 96_storage.sql can be validated locally.
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id), name text, owner uuid
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant usage on schema storage to postgres, authenticated, anon, service_role;
grant all on storage.buckets, storage.objects to postgres, service_role;
grant select, insert, update, delete on storage.objects to authenticated;
alter table storage.objects owner to postgres;
alter table storage.buckets owner to postgres;
