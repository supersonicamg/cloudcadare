-- =============================================================================
-- 92_my_access.sql  —  what can the signed-in user do inside one academy?
-- One round trip for the app's Principal (packages/permissions): member id, status,
-- tenant-wide permission keys and the session's MFA level. Authorisation itself is
-- still enforced by RLS; this only drives which UI and server paths to offer.
-- =============================================================================
create or replace function public.my_access(p_tenant_id uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object(
        'member_id',   m.id,
        'status',      m.status,
        'display_name', m.display_name,
        'aal',         coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', 'aal1'),
        'permissions', coalesce((
            select jsonb_agg(distinct rp.permission_key)
            from public.member_roles mr
            join public.role_permissions rp on rp.role_id = mr.role_id
            where mr.member_id = m.id and mr.scope_type = 'tenant'
              and (mr.expires_at is null or mr.expires_at > now())), '[]'::jsonb))
     from public.tenant_members m
     where m.tenant_id = p_tenant_id and m.user_id = (select auth.uid()) and m.status = 'active'),
    'null'::jsonb)
$$;

revoke execute on function public.my_access(uuid) from public, anon;
grant  execute on function public.my_access(uuid) to authenticated;
