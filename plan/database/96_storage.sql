-- =============================================================================
-- 96_storage.sql  —  Supabase Storage buckets & policies
-- Object path convention:  {tenant_id}/{area}/{uuid}.{ext}
--   public-assets : {tenant_id}/branding|courses|site|blog/...      (public CDN URLs)
--   course-media  : {tenant_id}/lessons/{lesson_id}/...             (private; signed URLs minted by server after entitlement check)
--   submissions   : {tenant_id}/{member_id}/{assignment_id}/...     (private; learner uploads own, graders read)
--   exports       : {tenant_id}/exports/...                         (private; service only, short-lived signed URLs)
-- Videos do NOT go here – they go to the video provider (Mux/Bunny/VdoCipher).
-- SVG is intentionally not allowed in public-assets (stored-XSS vector).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('public-assets', 'public-assets', true,  10485760,
     array['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon']),
  ('course-media',  'course-media',  false, 524288000, null),
  ('submissions',   'submissions',   false, 52428800,  null),
  ('exports',       'exports',       false, null,      null)
on conflict (id) do nothing;

-- public-assets: anyone can read via public URL (bucket is public); staff upload.
create policy "public-assets staff write" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-assets' and (storage.foldername(name))[1] in (
    select t::text from private.perm_tenants('content.upload') t
    union select t::text from private.perm_tenants('tenant.branding.manage') t
    union select t::text from private.perm_tenants('site.manage') t));
create policy "public-assets staff update" on storage.objects for update to authenticated
  using (bucket_id = 'public-assets' and (storage.foldername(name))[1] in (
    select t::text from private.perm_tenants('content.upload') t
    union select t::text from private.perm_tenants('tenant.branding.manage') t
    union select t::text from private.perm_tenants('site.manage') t));
create policy "public-assets staff delete" on storage.objects for delete to authenticated
  using (bucket_id = 'public-assets' and (storage.foldername(name))[1] in (
    select t::text from private.perm_tenants('content.upload') t
    union select t::text from private.perm_tenants('site.manage') t));

-- course-media: staff upload & preview. Learners NEVER read directly.
create policy "course-media staff all" on storage.objects for all to authenticated
  using (bucket_id = 'course-media' and (storage.foldername(name))[1] in (select t::text from private.perm_tenants('content.upload') t))
  with check (bucket_id = 'course-media' and (storage.foldername(name))[1] in (select t::text from private.perm_tenants('content.upload') t));

-- submissions: learner writes/reads own folder; graders read the tenant.
create policy "submissions owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'submissions' and (storage.foldername(name))[2] in (select m::text from private.my_member_ids() m)
              and (storage.foldername(name))[1] in (select t::text from private.my_tenant_ids() t));
create policy "submissions owner read" on storage.objects for select to authenticated
  using (bucket_id = 'submissions' and (storage.foldername(name))[2] in (select m::text from private.my_member_ids() m));
create policy "submissions grader read" on storage.objects for select to authenticated
  using (bucket_id = 'submissions' and (storage.foldername(name))[1] in (select t::text from private.perm_tenants('assignment.grade') t));

-- exports: no policies → service role only.
