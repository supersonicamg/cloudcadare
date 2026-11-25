-- =============================================================================
-- b1_self_hosted_video.sql  —  videos on the academy's own server (plan/17 §8)
--  A new media provider. metadata->>'path' is the file's path inside the academy's folder; the app signs an expiring
--  address for it. No new rights: media_assets stays staff-only under row-level security.
-- =============================================================================

alter table public.media_assets drop constraint media_assets_provider_check;
alter table public.media_assets add constraint media_assets_provider_check
  check (provider in ('supabase', 'mux', 'bunny', 'vdocipher', 'cloudflare_stream', 'youtube', 'vimeo', 'external_url', 'self_hosted'));
