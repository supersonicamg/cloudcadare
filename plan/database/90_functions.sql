-- =============================================================================
-- 90_functions.sql
-- 1. Identity & permission helpers used by RLS      (private.*)
-- 2. Feature entitlement helpers & plan limits       (private.*)
-- 3. Control plane: entitlement resolution, license redemption, sync
-- 4. Tenant bootstrap
-- 5. Learning RPCs: progress, completion, XP, streaks
-- 6. Assessment RPCs: start / paper / save / submit / grade / rank
-- 7. Gamification: leaderboards
-- 8. Reporting views (syllabus vs plan, enrollment overview)
-- 9. Triggers (updated_at, counters, limits, audit)
--
-- All SECURITY DEFINER functions: `set search_path = ''` and fully-qualified
-- names (prevents search_path hijacking). RPCs callable by learners are in
-- `public` and explicitly granted in 95_rls_policies.sql.
-- =============================================================================

-- ===================================================== 1. identity helpers
-- Pattern for RLS performance: policies use `tenant_id IN (SELECT private.fn())`.
-- The subquery is uncorrelated → evaluated ONCE per statement and hashed,
-- instead of once per row.

create or replace function private.my_member_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select m.id from public.tenant_members m
  where m.user_id = (select auth.uid()) and m.status = 'active'
$$;

create or replace function private.my_tenant_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select m.tenant_id from public.tenant_members m
  where m.user_id = (select auth.uid()) and m.status = 'active'
$$;

-- Tenants where the caller holds `p_perm` with TENANT-wide scope.
-- Sensitive permissions require an MFA session (aal2) when the tenant enforces it.
create or replace function private.perm_tenants(p_perm text)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select distinct mr.tenant_id
  from public.tenant_members m
  join public.member_roles mr     on mr.member_id = m.id
                                 and mr.scope_type = 'tenant'
                                 and (mr.expires_at is null or mr.expires_at > now())
  join public.role_permissions rp on rp.role_id = mr.role_id and rp.permission_key = p_perm
  join public.permission_catalog pc on pc.key = rp.permission_key
  left join public.tenant_settings ts on ts.tenant_id = m.tenant_id
  where m.user_id = (select auth.uid())
    and m.status = 'active'
    and (
      not pc.is_sensitive
      or coalesce((ts.security ->> 'require_mfa_for_sensitive')::boolean, false) = false
      or coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'aal', '') = 'aal2'
    )
$$;

-- (tenant_id, scope_id) pairs where the caller holds `p_perm` scoped to a branch / batch / course.
create or replace function private.perm_scopes(p_perm text, p_scope_type text)
returns table (tenant_id uuid, scope_id uuid) language sql stable security definer set search_path = '' as $$
  select distinct mr.tenant_id, mr.scope_id
  from public.tenant_members m
  join public.member_roles mr     on mr.member_id = m.id
                                 and mr.scope_type = p_scope_type
                                 and (mr.expires_at is null or mr.expires_at > now())
  join public.role_permissions rp on rp.role_id = mr.role_id and rp.permission_key = p_perm
  where m.user_id = (select auth.uid()) and m.status = 'active'
$$;

create or replace function private.has_perm(p_tenant uuid, p_perm text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.perm_tenants(p_perm) t where t = p_tenant)
$$;

-- Courses / batches the caller can currently access as a learner.
create or replace function private.my_course_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select e.course_id from public.enrollments e
  where e.member_id in (select private.my_member_ids())
    and e.status = 'active' and (e.expires_at is null or e.expires_at > now())
$$;

create or replace function private.my_batch_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select e.batch_id from public.enrollments e
  where e.member_id in (select private.my_member_ids())
    and e.batch_id is not null
    and e.status = 'active' and (e.expires_at is null or e.expires_at > now())
$$;

-- ===================================================== 2. features & limits
-- effective(feature) = entitled (bought) AND enabled by tenant admin
create or replace function private.feature_enabled(p_tenant uuid, p_feature text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select e.enabled and coalesce(tm.is_enabled, true)
    from public.tenant_entitlements e
    left join public.tenant_modules tm on tm.tenant_id = e.tenant_id and tm.feature_key = e.feature_key
    where e.tenant_id = p_tenant and e.feature_key = p_feature
  ), false)
$$;

-- Caller's tenants where a feature is effectively on (for RLS gating of whole modules).
create or replace function private.feature_tenants(p_feature text)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select e.tenant_id
  from public.tenant_entitlements e
  left join public.tenant_modules tm on tm.tenant_id = e.tenant_id and tm.feature_key = e.feature_key
  where e.feature_key = p_feature
    and e.enabled and coalesce(tm.is_enabled, true)
    and e.tenant_id in (select private.my_tenant_ids())
$$;

-- NULL = unlimited. Raises if entitlements were never synced (fail closed).
create or replace function private.feature_limit(p_tenant uuid, p_feature text)
returns bigint language plpgsql stable security definer set search_path = '' as $$
declare v_limit bigint; v_enabled boolean;
begin
  select e.limit_value, e.enabled into v_limit, v_enabled
  from public.tenant_entitlements e where e.tenant_id = p_tenant and e.feature_key = p_feature;
  if not found then
    raise exception 'entitlement_missing:%', p_feature using errcode = 'P0001';
  end if;
  if not v_enabled then return 0; end if;
  return v_limit;
end $$;

-- Human-readable per-tenant sequences (order no, invoice no, roll no).
create or replace function private.next_counter(p_tenant uuid, p_key text)
returns bigint language sql volatile security definer set search_path = '' as $$
  insert into public.tenant_counters as c (tenant_id, counter_key, value) values (p_tenant, p_key, 1)
  on conflict (tenant_id, counter_key) do update set value = c.value + 1
  returning c.value
$$;

-- Hard plan limits on row counts. Usage: trigger args (feature_key, sql_filter).
-- Bulk imports validate the limit once and set `app.bulk_limit_checked = on` (server-only GUC).
create or replace function private.enforce_count_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_feature text := tg_argv[0];
  v_filter  text := coalesce(tg_argv[1], 'true');
  v_limit   bigint;
  v_count   bigint;
begin
  if new.tenant_id is null or current_setting('app.bulk_limit_checked', true) = 'on' then
    return new;   -- NULL tenant: let NOT NULL / RLS reject it with the proper error
  end if;
  v_limit := private.feature_limit(new.tenant_id, v_feature);
  if v_limit is null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text || ':' || v_feature, 0));
  execute format('select count(*) from %I.%I where tenant_id = $1 and (%s)', tg_table_schema, tg_table_name, v_filter)
    into v_count using new.tenant_id;
  if v_count >= v_limit then
    raise exception 'plan_limit_reached:%', v_feature
      using errcode = 'P0001', detail = format('limit=%s current=%s', v_limit, v_count),
            hint = 'Upgrade the plan or buy an add-on';
  end if;
  return new;
end $$;

-- ===================================================== 3. control plane
create or replace function control.distributor_subtree(p_root uuid)
returns setof uuid language sql stable set search_path = '' as $$
  with recursive tree as (
    select d.id from control.distributors d where d.id = p_root
    union all
    select c.id from control.distributors c join tree t on c.parent_id = t.id
  )
  select id from tree
$$;

-- Precedence: core > override > (plan ∪ add-ons) > feature default. Limits: override > add-on 'set' >
-- plan (+ add-on 'add' × quantity) > default. NULL limit = unlimited.
create or replace function control.resolve_entitlements(p_tenant uuid)
returns table (feature_key text, enabled boolean, limit_value bigint, config jsonb, source text)
language sql stable set search_path = '' as $$
  with sub as (
    select s.plan_id from control.tenant_subscriptions s
    where s.tenant_id = p_tenant and s.status in ('trialing', 'active', 'past_due', 'paused')
    order by s.created_at desc limit 1
  ),
  plan as (
    select pf.feature_key, pf.enabled, pf.limit_value, pf.config
    from control.plan_features pf join sub on sub.plan_id = pf.plan_id
  ),
  addon as (
    select af.feature_key,
           bool_or(af.enabled)                                             as enabled,
           sum(af.limit_value * ta.quantity) filter (where af.limit_mode = 'add') as limit_add,
           max(af.limit_value)               filter (where af.limit_mode = 'set') as limit_set
    from control.tenant_addons ta
    join control.addon_features af on af.addon_id = ta.addon_id
    where ta.tenant_id = p_tenant and ta.status = 'active'
      and ta.starts_at <= now() and (ta.ends_at is null or ta.ends_at > now())
    group by af.feature_key
  ),
  ovr as (
    select o.feature_key, o.enabled, o.limit_value, o.config
    from control.tenant_feature_overrides o
    where o.tenant_id = p_tenant and (o.expires_at is null or o.expires_at > now())
  )
  select
    f.key,
    case
      when f.is_core then true
      when ovr.enabled is not null then ovr.enabled
      when plan.feature_key is not null or addon.feature_key is not null
        then coalesce(plan.enabled, false) or coalesce(addon.enabled, false)
      else f.default_enabled
    end,
    -- a plan that LISTS a feature wins over the default, even with NULL (= unlimited)
    coalesce(ovr.limit_value, addon.limit_set,
             (case when plan.feature_key is not null then plan.limit_value else f.default_limit end)
               + coalesce(addon.limit_add, 0)),
    coalesce(plan.config, '{}'::jsonb) || coalesce(ovr.config, '{}'::jsonb),
    case
      when f.is_core then 'core'
      when ovr.feature_key is not null and (ovr.enabled is not null or ovr.limit_value is not null) then 'override'
      when addon.feature_key is not null then 'addon'
      when plan.feature_key is not null then 'plan'
      else 'default'
    end
  from control.features f
  left join plan  on plan.feature_key  = f.key
  left join addon on addon.feature_key = f.key
  left join ovr   on ovr.feature_key   = f.key
  where f.lifecycle <> 'deprecated'
$$;

create or replace function control.refresh_entitlements(p_tenant uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from control.tenant_entitlements where tenant_id = p_tenant;
  insert into control.tenant_entitlements (tenant_id, feature_key, enabled, limit_value, config, source)
  select p_tenant, r.feature_key, r.enabled, r.limit_value, r.config, r.source
  from control.resolve_entitlements(p_tenant) r;

  -- A feature whose dependency is off is off. Iterate until stable (chains are short).
  loop
    update control.tenant_entitlements e
       set enabled = false, source = 'dependency'
     where e.tenant_id = p_tenant and e.enabled
       and exists (
         select 1
         from control.features f
         cross join lateral unnest(f.depends_on) as d(dep_key)
         join control.tenant_entitlements e2 on e2.tenant_id = p_tenant and e2.feature_key = d.dep_key
         where f.key = e.feature_key and not e2.enabled
       );
    exit when not found;
  end loop;

  insert into control.outbox_events (tenant_id, event_type, payload)
  values (p_tenant, 'tenant.entitlements_changed', jsonb_build_object('tenant_id', p_tenant));
end $$;

-- Single-project deployments (phase 1): copy the projection straight into the
-- data plane. Multi-project: the sync worker does the same over the network.
create or replace function control.sync_tenant_local(p_tenant uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.tenants as t (id, slug, name, status, vertical_key, frontend_template_key,
                                   timezone, default_locale, currency, country, synced_at)
  select c.id, c.slug, c.name, c.status, c.vertical_key, c.frontend_template_key,
         c.timezone, c.default_locale, c.currency, c.country, now()
  from control.tenants c where c.id = p_tenant
  on conflict (id) do update set
    slug = excluded.slug, name = excluded.name, status = excluded.status,
    vertical_key = excluded.vertical_key, frontend_template_key = excluded.frontend_template_key,
    timezone = excluded.timezone, default_locale = excluded.default_locale,
    currency = excluded.currency, country = excluded.country, synced_at = now();

  delete from public.tenant_entitlements where tenant_id = p_tenant;
  insert into public.tenant_entitlements (tenant_id, feature_key, enabled, limit_value, config, synced_at)
  select tenant_id, feature_key, enabled, limit_value, config, now()
  from control.tenant_entitlements where tenant_id = p_tenant;
end $$;

-- Redeem a distributor license key → create tenant (control side only).
-- Called by the onboarding server action with the secret key, after the user
-- has signed up/in. Returns the new tenant id. Data-plane bootstrap follows.
create or replace function control.redeem_license(
  p_key           text,
  p_user_id       uuid,
  p_slug          text,
  p_name          text,
  p_contact_phone text default null,
  p_ip            inet default null,
  p_user_agent    text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  k            control.license_keys;
  v_plan       control.plans;
  v_dist       control.distributors;
  v_tenant     uuid;
  v_plane      uuid;
  v_email      text;
  v_base       text;
  v_slug       text := lower(trim(p_slug));
  v_term_end   timestamptz;
  v_tenants    int;
begin
  select * into k from control.license_keys
  where key_hash = sha256(convert_to(upper(trim(p_key)), 'UTF8'))
  for update;
  if not found                                     then raise exception 'license_invalid'   using errcode = 'P0001'; end if;
  if k.status <> 'active'                          then raise exception 'license_%', k.status using errcode = 'P0001'; end if;
  if k.expires_at is not null and k.expires_at < now() then
    update control.license_keys set status = 'expired' where id = k.id;
    raise exception 'license_expired' using errcode = 'P0001';
  end if;
  if k.activation_count >= k.max_activations       then raise exception 'license_exhausted' using errcode = 'P0001'; end if;

  select u.email into v_email from auth.users u where u.id = p_user_id;
  if v_email is null and k.restricted_email is not null then raise exception 'user_not_found' using errcode = 'P0001'; end if;
  if k.restricted_email is not null and lower(k.restricted_email) <> lower(v_email) then
    raise exception 'license_bound_to_other_email' using errcode = 'P0001';
  end if;

  if exists (select 1 from control.reserved_slugs r where r.slug = v_slug) then
    raise exception 'slug_reserved' using errcode = 'P0001';
  end if;

  select * into v_dist from control.distributors where id = k.distributor_id;
  if v_dist.status <> 'active' then raise exception 'distributor_inactive' using errcode = 'P0001'; end if;
  if v_dist.max_tenants is not null then
    select count(*) into v_tenants from control.tenants where distributor_id = v_dist.id and status not in ('archived');
    if v_tenants >= v_dist.max_tenants then raise exception 'distributor_tenant_limit' using errcode = 'P0001'; end if;
  end if;

  select * into v_plan from control.plans where id = k.plan_id;

  if k.deployment_mode = 'pooled' then
    select dp.id into v_plane
    from control.data_planes dp
    left join control.tenants t on t.data_plane_id = dp.id
    where dp.mode = 'pooled' and dp.status = 'active'
    group by dp.id, dp.max_tenants
    having dp.max_tenants is null or count(t.id) < dp.max_tenants
    order by count(t.id) asc
    limit 1;
    if v_plane is null then raise exception 'no_capacity' using errcode = 'P0001'; end if;
  else
    insert into control.data_planes (name, mode, status)
    values ('dedicated-' || v_slug, 'dedicated', 'maintenance')   -- worker creates the Supabase project
    returning id into v_plane;
  end if;

  insert into control.tenants (distributor_id, slug, name, status, vertical_key, frontend_template_key,
                               deployment_mode, data_plane_id, owner_user_id, license_key_id,
                               contact_email, contact_phone, trial_ends_at)
  values (k.distributor_id, v_slug, p_name,
          case when k.deployment_mode = 'dedicated' then 'provisioning'
               when v_plan.trial_days > 0 and k.term_days is null then 'trial'
               else 'active' end,
          k.vertical_key, coalesce(k.frontend_template_key, 'default'),
          k.deployment_mode, v_plane, p_user_id, k.id,
          v_email, p_contact_phone,
          case when v_plan.trial_days > 0 and k.term_days is null then now() + make_interval(days => v_plan.trial_days) end)
  returning id into v_tenant;

  select (value #>> '{}') into v_base from control.platform_settings where key = 'base_domain';
  insert into control.tenant_domains (tenant_id, hostname, kind, is_primary, verification_status, ssl_status, verified_at)
  values (v_tenant, v_slug || '.' || coalesce(v_base, 'localhost'), 'platform_subdomain', true, 'verified', 'issued', now());

  v_term_end := case when k.term_days is not null then now() + make_interval(days => k.term_days) end;
  insert into control.tenant_subscriptions (tenant_id, plan_id, status, billing_provider, currency,
                                            current_period_start, current_period_end)
  values (v_tenant, k.plan_id,
          case when v_plan.trial_days > 0 and k.term_days is null then 'trialing' else 'active' end,
          'license', v_plan.currency, now(), v_term_end);

  insert into control.tenant_addons (tenant_id, addon_id, quantity, ends_at)
  select v_tenant, a.id, 1, v_term_end
  from control.addons a
  where a.code = any (k.addon_codes) and a.status = 'active'
    and a.distributor_id in (k.distributor_id, (select id from control.distributors where kind = 'platform'));

  insert into control.tenant_feature_overrides (tenant_id, feature_key, enabled, limit_value, reason, set_by)
  select v_tenant, o.key, (o.value ->> 'enabled')::boolean, (o.value ->> 'limit_value')::bigint,
         'license:' || k.key_hint, k.created_by
  from jsonb_each(k.feature_overrides) as o(key, value)
  where exists (select 1 from control.features f where f.key = o.key);

  insert into control.license_activations (license_key_id, tenant_id, activated_by, ip, user_agent)
  values (k.id, v_tenant, p_user_id, p_ip, p_user_agent);

  update control.license_keys
     set activation_count = activation_count + 1,
         status = case when activation_count + 1 >= max_activations then 'exhausted' else status end
   where id = k.id;

  perform control.refresh_entitlements(v_tenant);

  insert into control.provisioning_jobs (tenant_id, kind, payload)
  values (v_tenant, 'provision', jsonb_build_object('owner_user_id', p_user_id, 'vertical_key', k.vertical_key));

  insert into control.audit_logs (actor_user_id, actor_distributor_id, tenant_id, action, target_type, target_id, after, ip, user_agent)
  values (p_user_id, k.distributor_id, v_tenant, 'license.redeemed', 'license_key', k.id::text,
          jsonb_build_object('slug', v_slug, 'plan', v_plan.code), p_ip, p_user_agent);

  return v_tenant;
end $$;

-- ===================================================== 4. tenant bootstrap
-- Idempotent. Seeds roles, owner, settings, vertical defaults, starter site.
-- p_vertical = control.vertical_templates row as jsonb (sent by the provisioning worker).
create or replace function public.bootstrap_tenant(
  p_tenant_id     uuid,
  p_owner_user_id uuid,
  p_owner_name    text,
  p_owner_email   text,
  p_vertical      jsonb default '{}'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  r        record;
  v_role   uuid;
  v_owner  uuid;
  v_name   text;
  v_home   jsonb;
begin
  select name into v_name from public.tenants where id = p_tenant_id;
  if v_name is null then raise exception 'tenant_not_synced' using errcode = 'P0001'; end if;

  insert into public.tenant_branding (tenant_id, display_name) values (p_tenant_id, v_name)
  on conflict (tenant_id) do nothing;

  insert into public.tenant_settings (tenant_id, terminology, learning, assessment, security)
  values (p_tenant_id,
          coalesce(p_vertical -> 'terminology', '{}'),
          coalesce(p_vertical #> '{default_settings,learning}', '{}'),
          coalesce(p_vertical #> '{default_settings,assessment}', '{}'),
          coalesce(p_vertical #> '{default_settings,security}', '{"require_mfa_for_sensitive":false}'))
  on conflict (tenant_id) do nothing;

  for r in select * from private.role_templates order by sort_order loop
    insert into public.roles (tenant_id, key, name, description, kind, is_system, sort_order)
    values (p_tenant_id, r.key, r.name, r.description, r.kind, true, r.sort_order)
    on conflict (tenant_id, key) do update set name = excluded.name
    returning id into v_role;

    insert into public.role_permissions (tenant_id, role_id, permission_key)
    select p_tenant_id, v_role, pc.key
    from public.permission_catalog pc
    where '*' = any (r.permissions) or pc.key = any (r.permissions)
    on conflict do nothing;
  end loop;

  insert into public.tenant_members (tenant_id, user_id, display_name, email, status)
  values (p_tenant_id, p_owner_user_id, p_owner_name, p_owner_email, 'active')
  on conflict (tenant_id, user_id) do update set status = 'active'
  returning id into v_owner;

  insert into public.member_roles (tenant_id, member_id, role_id)
  select p_tenant_id, v_owner, id from public.roles where tenant_id = p_tenant_id and key = 'owner'
  on conflict do nothing;

  insert into public.tenant_modules (tenant_id, feature_key, is_enabled)
  select p_tenant_id, f, false
  from jsonb_array_elements_text(coalesce(p_vertical -> 'disabled_modules', '[]')) as f
  on conflict do nothing;

  insert into public.levels (tenant_id, level_no, name, min_xp)
  select p_tenant_id, (l ->> 'level_no')::int, l ->> 'name', (l ->> 'min_xp')::int
  from jsonb_array_elements(coalesce(p_vertical #> '{seed,levels}', '[]')) as l
  on conflict do nothing;

  insert into public.badges (tenant_id, key, name, description, tier, criteria, xp_reward)
  select p_tenant_id, b ->> 'key', b ->> 'name', b ->> 'description', coalesce(b ->> 'tier', 'bronze'),
         b -> 'criteria', coalesce((b ->> 'xp_reward')::int, 0)
  from jsonb_array_elements(coalesce(p_vertical #> '{seed,badges}', '[]')) as b
  on conflict do nothing;

  insert into public.leaderboards (tenant_id, key, name, metric, period)
  values (p_tenant_id, 'weekly_xp', 'This week', 'xp', 'weekly'),
         (p_tenant_id, 'all_time_xp', 'All time', 'xp', 'all_time')
  on conflict do nothing;

  v_home := jsonb_build_array(
    jsonb_build_object('id', 'hero',     'type', 'hero',          'props', jsonb_build_object('heading', v_name, 'subheading', 'Learn from the best', 'cta', jsonb_build_object('label', 'Explore courses', 'href', '/courses'))),
    jsonb_build_object('id', 'courses',  'type', 'course_grid',   'props', jsonb_build_object('source', 'featured', 'limit', 6)),
    jsonb_build_object('id', 'faculty',  'type', 'faculty_strip', 'props', jsonb_build_object('limit', 8)),
    jsonb_build_object('id', 'results',  'type', 'showcase',      'props', jsonb_build_object('kind', 'testimonial')),
    jsonb_build_object('id', 'contact',  'type', 'lead_form',     'props', jsonb_build_object('form_key', 'enquiry'))
  );
  insert into public.site_pages (tenant_id, path, title, is_system, status, blocks, published_blocks, published_at)
  values (p_tenant_id, '/',        'Home',    true, 'published', v_home, v_home, now()),
         (p_tenant_id, '/about',   'About',   true, 'draft', '[]', null, null),
         (p_tenant_id, '/contact', 'Contact', true, 'draft', '[]', null, null)
  on conflict do nothing;

  insert into public.site_navigation (tenant_id, location, items)
  values (p_tenant_id, 'header', '[{"label":"Courses","href":"/courses"},{"label":"About","href":"/about"},{"label":"Contact","href":"/contact"}]')
  on conflict do nothing;

  insert into public.forms (tenant_id, key, name, fields)
  values (p_tenant_id, 'enquiry', 'Enquiry',
          '[{"key":"full_name","type":"text","required":true},{"key":"phone","type":"phone","required":true},{"key":"email","type":"email"},{"key":"message","type":"textarea"}]')
  on conflict do nothing;

  insert into public.notification_templates (tenant_id, event_key, channel, subject, body)
  select p_tenant_id, t.event_key, t.channel, t.subject, t.body
  from public.notification_templates t where t.tenant_id is null
  on conflict do nothing;

  return v_owner;
end $$;

-- Phase-1 convenience: control + data plane in the same database.
create or replace function control.provision_local(p_tenant uuid, p_owner_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_t      control.tenants;
  v_vert   jsonb;
  v_email  text;
  v_member uuid;
begin
  select * into v_t from control.tenants where id = p_tenant;
  select to_jsonb(v) into v_vert from control.vertical_templates v where v.key = v_t.vertical_key;
  select email into v_email from auth.users where id = v_t.owner_user_id;

  perform control.sync_tenant_local(p_tenant);
  v_member := public.bootstrap_tenant(p_tenant, v_t.owner_user_id, p_owner_name, v_email, coalesce(v_vert, '{}'));

  update control.provisioning_jobs set status = 'succeeded', finished_at = now()
   where tenant_id = p_tenant and kind = 'provision' and status = 'queued';
  return v_member;
end $$;

-- ===================================================== 5. learning
create or replace function private.award_xp(
  p_tenant uuid, p_member uuid, p_points int, p_reason text,
  p_source_type text, p_source_id uuid, p_idempotency_key text
) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_points = 0 or not private.feature_enabled(p_tenant, 'engage.gamification') then
    return false;
  end if;
  insert into public.xp_ledger (tenant_id, member_id, points, reason, source_type, source_id, idempotency_key)
  values (p_tenant, p_member, p_points, p_reason, p_source_type, p_source_id, p_idempotency_key)
  on conflict (tenant_id, idempotency_key) do nothing;
  return found;
end $$;

-- Daily rollup + streak, in the tenant's timezone.
create or replace function private.touch_daily_activity(
  p_tenant uuid, p_member uuid, p_seconds int, p_lessons int, p_tests int
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_day date;
begin
  select (now() at time zone t.timezone)::date into v_day from public.tenants t where t.id = p_tenant;

  insert into public.daily_activity as d (tenant_id, member_id, day, active_seconds, lessons_completed, tests_submitted)
  values (p_tenant, p_member, v_day, p_seconds, p_lessons, p_tests)
  on conflict (tenant_id, member_id, day) do update set
    active_seconds    = d.active_seconds + excluded.active_seconds,
    lessons_completed = d.lessons_completed + excluded.lessons_completed,
    tests_submitted   = d.tests_submitted + excluded.tests_submitted;

  insert into public.member_stats as s (tenant_id, member_id, current_streak, longest_streak, last_active_day, lessons_completed)
  values (p_tenant, p_member, 1, 1, v_day, p_lessons)
  on conflict (member_id) do update set
    current_streak = case when s.last_active_day = v_day     then s.current_streak
                          when s.last_active_day = v_day - 1 then s.current_streak + 1
                          else 1 end,
    longest_streak = greatest(s.longest_streak,
                         case when s.last_active_day = v_day     then s.current_streak
                              when s.last_active_day = v_day - 1 then s.current_streak + 1
                              else 1 end),
    last_active_day   = v_day,
    lessons_completed = s.lessons_completed + excluded.lessons_completed,
    updated_at        = now();

  update public.tenant_members set last_active_at = now()
   where id = p_member and (last_active_at is null or last_active_at < now() - interval '5 minutes');
end $$;

create or replace function private.recompute_enrollment_progress(p_enrollment uuid)
returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  v_e         public.enrollments;
  v_total     int;
  v_done      int;
  v_pct       numeric(5,2);
  v_threshold numeric;
begin
  select * into v_e from public.enrollments where id = p_enrollment;

  select count(*) filter (where l.is_mandatory),
         count(*) filter (where l.is_mandatory and lp.status = 'completed')
    into v_total, v_done
  from public.lessons l
  left join public.lesson_progress lp on lp.lesson_id = l.id and lp.enrollment_id = p_enrollment
  where l.course_id = v_e.course_id and l.is_published and l.deleted_at is null;

  v_pct := case when v_total = 0 then 0 else round(v_done * 100.0 / v_total, 2) end;
  select coalesce((c.settings ->> 'completion_threshold_pct')::numeric, 100) into v_threshold
  from public.courses c where c.id = v_e.course_id;

  update public.enrollments
     set lessons_total = v_total, lessons_completed = v_done, progress_pct = v_pct,
         status       = case when v_pct >= v_threshold and status = 'active' then 'completed' else status end,
         completed_at = case when v_pct >= v_threshold and completed_at is null then now() else completed_at end
   where id = p_enrollment;

  if v_pct >= v_threshold and v_e.completed_at is null then
    insert into public.outbox_events (tenant_id, event_type, aggregate_type, aggregate_id, payload)
    values (v_e.tenant_id, 'course.completed', 'enrollment', p_enrollment,
            jsonb_build_object('member_id', v_e.member_id, 'course_id', v_e.course_id));
    perform private.award_xp(v_e.tenant_id, v_e.member_id, 100, 'course.completed', 'course', v_e.course_id,
                             'course:' || v_e.course_id || ':' || v_e.member_id);
  end if;
  return v_pct;
end $$;

create or replace function private.complete_lesson_effects(p_enrollment public.enrollments, p_lesson public.lessons)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.recompute_enrollment_progress(p_enrollment.id);
  insert into public.learning_events (tenant_id, member_id, verb, object_type, object_id, context)
  values (p_lesson.tenant_id, p_enrollment.member_id, 'lesson.completed', 'lesson', p_lesson.id,
          jsonb_build_object('course_id', p_lesson.course_id));
  insert into public.outbox_events (tenant_id, event_type, aggregate_type, aggregate_id, payload)
  values (p_lesson.tenant_id, 'lesson.completed', 'lesson', p_lesson.id,
          jsonb_build_object('member_id', p_enrollment.member_id, 'course_id', p_lesson.course_id));
  perform private.award_xp(p_lesson.tenant_id, p_enrollment.member_id, p_lesson.xp_points, 'lesson.completed',
                           'lesson', p_lesson.id, 'lesson:' || p_lesson.id || ':' || p_enrollment.member_id);
end $$;

-- Learner heartbeat / completion. Called from the player every ~15s and on
-- page-close (sendBeacon). Server-side validation: membership, active enrollment,
-- published lesson, completion rule, capped time delta (anti-farming).
create or replace function public.record_lesson_progress(
  p_lesson_id        uuid,
  p_position_seconds int     default null,
  p_delta_seconds    int     default 0,
  p_progress_pct     numeric default null,
  p_mark_complete    boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_lesson     public.lessons;
  v_member     uuid;
  v_enrollment public.enrollments;
  v_prev       text;
  v_rule       text;
  v_threshold  numeric;
  v_pct        numeric := least(greatest(coalesce(p_progress_pct, 0), 0), 100);
  v_delta      int     := least(greatest(coalesce(p_delta_seconds, 0), 0), 120);
  v_complete   boolean := false;
  v_newly      boolean := false;
begin
  select * into v_lesson from public.lessons
  where id = p_lesson_id and is_published and deleted_at is null;
  if not found then raise exception 'lesson_not_found' using errcode = 'P0002'; end if;

  select m.id into v_member from public.tenant_members m
  where m.tenant_id = v_lesson.tenant_id and m.user_id = (select auth.uid()) and m.status = 'active';
  if v_member is null then raise exception 'not_a_member' using errcode = '42501'; end if;

  if not private.feature_enabled(v_lesson.tenant_id, 'learning.progress') then
    return jsonb_build_object('tracked', false);
  end if;

  select * into v_enrollment from public.enrollments e
  where e.tenant_id = v_lesson.tenant_id and e.member_id = v_member and e.course_id = v_lesson.course_id
    and e.status in ('active', 'completed') and (e.expires_at is null or e.expires_at > now())
  for update;
  if not found then raise exception 'not_enrolled' using errcode = '42501'; end if;

  v_rule      := coalesce(v_lesson.completion_rule ->> 'type', 'auto');
  v_threshold := coalesce((v_lesson.completion_rule ->> 'pct')::numeric, 90);
  v_complete  := case v_rule
    when 'auto'      then case when v_lesson.type in ('video', 'audio') then v_pct >= v_threshold
                               when v_lesson.type in ('quiz', 'test', 'assignment', 'live') then false
                               else true end
    when 'view'      then true
    when 'watch_pct' then v_pct >= v_threshold
    when 'manual'    then coalesce(p_mark_complete, false)
    else false            -- pass_test / submit_assignment are completed by grading
  end;

  select lp.status into v_prev from public.lesson_progress lp
  where lp.enrollment_id = v_enrollment.id and lp.lesson_id = p_lesson_id;

  insert into public.lesson_progress as lp
    (tenant_id, enrollment_id, lesson_id, member_id, course_id, status, progress_pct,
     last_position_seconds, time_spent_seconds, completed_at)
  values
    (v_lesson.tenant_id, v_enrollment.id, p_lesson_id, v_member, v_lesson.course_id,
     case when v_complete then 'completed' else 'in_progress' end, v_pct,
     coalesce(p_position_seconds, 0), v_delta, case when v_complete then now() end)
  on conflict (enrollment_id, lesson_id) do update set
    progress_pct          = greatest(lp.progress_pct, excluded.progress_pct),
    last_position_seconds = coalesce(p_position_seconds, lp.last_position_seconds),
    time_spent_seconds    = lp.time_spent_seconds + v_delta,
    view_count            = lp.view_count + case when lp.last_viewed_at < now() - interval '30 minutes' then 1 else 0 end,
    last_viewed_at        = now(),
    status                = case when lp.status = 'completed' or v_complete then 'completed' else 'in_progress' end,
    completed_at          = coalesce(lp.completed_at, case when v_complete then now() end);

  v_newly := v_complete and v_prev is distinct from 'completed';

  update public.enrollments
     set total_time_seconds = total_time_seconds + v_delta,
         last_activity_at   = now(),
         last_lesson_id     = p_lesson_id
   where id = v_enrollment.id;

  if v_newly then
    perform private.complete_lesson_effects(v_enrollment, v_lesson);
  end if;

  perform private.touch_daily_activity(v_lesson.tenant_id, v_member, v_delta, case when v_newly then 1 else 0 end, 0);

  return jsonb_build_object(
    'tracked', true,
    'completed', v_complete or v_prev = 'completed',
    'newly_completed', v_newly,
    'course_progress_pct', (select progress_pct from public.enrollments where id = v_enrollment.id)
  );
end $$;

-- ===================================================== 6. assessments
create or replace function private.is_blank_response(r jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select r is null
      or jsonb_typeof(r) <> 'object'
      or coalesce((select bool_and(v = 'null'::jsonb or v = '""'::jsonb or v = '[]'::jsonb)
                   from jsonb_each(r) as t(k, v)), true)
$$;

create or replace function private.try_numeric(t text)
returns numeric language plpgsql immutable set search_path = '' as $$
begin
  return t::numeric;
exception when others then
  return null;
end $$;

create or replace function private.jsonb_text_set(j jsonb)
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct x order by x), '{}')
  from jsonb_array_elements_text(case when jsonb_typeof(j) = 'array' then j else '[]'::jsonb end) as x
$$;

-- Objective auto-grading. Manual types return outcome 'manual' (marks NULL).
create or replace function private.attempt_outcomes(p_attempt uuid)
returns table (question_id uuid, outcome text, marks numeric)
language sql stable security definer set search_path = '' as $$
  with paper as (
    select (e ->> 'q')::uuid as qid,
           coalesce((e ->> 'm')::numeric, 0) as m,
           coalesce((e ->> 'n')::numeric, 0) as n
    from public.test_attempts a, jsonb_array_elements(a.paper) as e
    where a.id = p_attempt
  ),
  base as (
    select p.qid, p.m, p.n, q.type, k.answer, k.grading, aa.response,
           private.jsonb_text_set(aa.response -> 'selected') as sel,
           private.jsonb_text_set(k.answer -> 'correct')     as cor
    from paper p
    join public.questions q          on q.id = p.qid
    left join public.question_keys k on k.question_id = p.qid
    left join public.attempt_answers aa on aa.attempt_id = p_attempt and aa.question_id = p.qid
  ),
  judged as (
    select b.*,
      case
        when private.is_blank_response(b.response) then 'unattempted'
        when b.answer is null or b.type in ('subjective', 'code', 'match', 'ordering', 'passage') then 'manual'
        when b.type in ('mcq_single', 'true_false', 'assertion_reason') then
          case when (b.response ->> 'selected') = (b.answer -> 'correct' ->> 0) then 'correct' else 'incorrect' end
        when b.type = 'mcq_multi' then
          case when b.sel = b.cor then 'correct'
               when coalesce((b.grading ->> 'partial')::boolean, false) and cardinality(b.sel) > 0 and b.sel <@ b.cor then 'partial'
               else 'incorrect' end
        when b.type = 'numeric' then
          case when abs(private.try_numeric(b.response ->> 'value') - (b.answer ->> 'value')::numeric)
                    <= coalesce((b.answer ->> 'tolerance')::numeric, 0) then 'correct' else 'incorrect' end
        when b.type = 'fill_blank' then
          case when exists (
                 select 1 from jsonb_array_elements_text(b.answer -> 'accepted') as acc
                 where case when coalesce((b.answer ->> 'case_sensitive')::boolean, false)
                            then trim(acc) = trim(b.response ->> 'text')
                            else lower(trim(acc)) = lower(trim(b.response ->> 'text')) end)
               then 'correct' else 'incorrect' end
        else 'manual'
      end as outcome
    from base b
  )
  select j.qid, j.outcome,
         case j.outcome
           when 'correct'     then j.m
           when 'incorrect'   then -j.n
           when 'partial'     then round(j.m * cardinality(j.sel)::numeric / greatest(cardinality(j.cor), 1), 2)
           when 'unattempted' then 0
           else null
         end
  from judged j
$$;

create or replace function private.grade_attempt(p_attempt uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  a        public.test_attempts;
  t        public.tests;
  v_score  numeric;
  v_corr   int;
  v_inc    int;
  v_un     int;
  v_manual int;
  v_lesson public.lessons;
  v_enr    public.enrollments;
begin
  select * into a from public.test_attempts where id = p_attempt for update;
  select * into t from public.tests where id = a.test_id;

  update public.attempt_answers aa
     set is_correct    = case o.outcome when 'correct' then true when 'incorrect' then false when 'partial' then false end,
         marks_awarded = o.marks
    from private.attempt_outcomes(p_attempt) o
   where aa.attempt_id = p_attempt and aa.question_id = o.question_id;

  select coalesce(sum(o.marks), 0),
         count(*) filter (where o.outcome = 'correct'),
         count(*) filter (where o.outcome in ('incorrect', 'partial')),
         count(*) filter (where o.outcome = 'unattempted'),
         count(*) filter (where o.outcome = 'manual')
    into v_score, v_corr, v_inc, v_un, v_manual
  from private.attempt_outcomes(p_attempt) o;

  update public.test_attempts
     set score             = v_score,
         correct_count     = v_corr,
         incorrect_count   = v_inc,
         unattempted_count = v_un,
         pending_manual    = v_manual,
         percentage        = case when coalesce(max_score, 0) > 0 then round(v_score * 100 / max_score, 2) end,
         is_passed         = case when t.pass_marks is not null then v_score >= t.pass_marks end,
         status            = case when v_manual = 0 then 'graded' else status end,
         graded_at         = case when v_manual = 0 then now() end
   where id = p_attempt
  returning * into a;

  if a.status <> 'graded' then
    return;   -- waits for a human grader; they call private.grade_attempt again after scoring manual answers
  end if;

  update public.member_stats s
     set tests_taken  = s.tests_taken + 1,
         avg_test_pct = round(((coalesce(s.avg_test_pct, 0) * s.tests_taken) + coalesce(a.percentage, 0)) / (s.tests_taken + 1), 2),
         updated_at   = now()
   where s.member_id = a.member_id;

  perform private.touch_daily_activity(a.tenant_id, a.member_id, 0, 0, 1);

  if coalesce(a.is_passed, true) then
    perform private.award_xp(a.tenant_id, a.member_id, 50, 'test.passed', 'test_attempt', a.id, 'test:' || a.test_id || ':' || a.member_id);
  end if;

  -- Lessons gated on this test ("pass_test") become complete.
  for v_lesson in
    select l.* from public.lessons l
    where l.test_id = a.test_id and l.is_published and l.deleted_at is null
      and (l.completion_rule ->> 'type' in ('pass_test', 'auto'))
  loop
    if (v_lesson.completion_rule ->> 'type') = 'pass_test' and not coalesce(a.is_passed, true) then
      continue;
    end if;
    select * into v_enr from public.enrollments e
    where e.member_id = a.member_id and e.course_id = v_lesson.course_id and e.status in ('active', 'completed')
    limit 1;
    continue when not found;
    insert into public.lesson_progress (tenant_id, enrollment_id, lesson_id, member_id, course_id, status, progress_pct, completed_at)
    values (a.tenant_id, v_enr.id, v_lesson.id, a.member_id, v_lesson.course_id, 'completed', 100, now())
    on conflict (enrollment_id, lesson_id) do update set status = 'completed', progress_pct = 100,
      completed_at = coalesce(public.lesson_progress.completed_at, now());
    perform private.complete_lesson_effects(v_enr, v_lesson);
  end loop;

  insert into public.learning_events (tenant_id, member_id, verb, object_type, object_id, context)
  values (a.tenant_id, a.member_id, 'test.graded', 'test', a.test_id,
          jsonb_build_object('attempt_id', a.id, 'percentage', a.percentage, 'score', a.score));
  insert into public.outbox_events (tenant_id, event_type, aggregate_type, aggregate_id, payload)
  values (a.tenant_id, 'test.graded', 'test_attempt', a.id,
          jsonb_build_object('member_id', a.member_id, 'test_id', a.test_id, 'percentage', a.percentage));
end $$;

create or replace function public.start_test_attempt(p_test_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  t         public.tests;
  v_member  uuid;
  v_enr     uuid;
  v_open    public.test_attempts;
  v_count   int;
  v_paper   jsonb;
  v_max     numeric;
  v_id      uuid;
  v_dead    timestamptz;
begin
  select * into t from public.tests where id = p_test_id and status = 'published' and deleted_at is null;
  if not found then raise exception 'test_not_available' using errcode = 'P0002'; end if;

  select m.id into v_member from public.tenant_members m
  where m.tenant_id = t.tenant_id and m.user_id = (select auth.uid()) and m.status = 'active';
  if v_member is null then raise exception 'not_a_member' using errcode = '42501'; end if;

  if not private.feature_enabled(t.tenant_id, 'assess.quizzes') then
    raise exception 'feature_disabled:assess.quizzes' using errcode = '42501';
  end if;
  if t.available_from is not null and now() < t.available_from then raise exception 'test_not_open' using errcode = 'P0001'; end if;
  if t.available_until is not null and now() > t.available_until then raise exception 'test_closed' using errcode = 'P0001'; end if;

  if t.course_id is not null then
    select e.id into v_enr from public.enrollments e
    where e.member_id = v_member and e.course_id = t.course_id and e.status in ('active', 'completed')
      and (e.expires_at is null or e.expires_at > now());
    if v_enr is null then raise exception 'not_enrolled' using errcode = '42501'; end if;
  end if;

  -- Resume an open attempt (or close it if its time is up).
  select * into v_open from public.test_attempts
  where test_id = p_test_id and member_id = v_member and status = 'in_progress';
  if found then
    if v_open.deadline_at is null or now() <= v_open.deadline_at + make_interval(secs => t.grace_seconds) then
      return v_open.id;
    end if;
    update public.test_attempts set status = 'auto_submitted', submitted_at = deadline_at,
           time_taken_seconds = extract(epoch from (deadline_at - started_at))::int
     where id = v_open.id;
    perform private.grade_attempt(v_open.id);
  end if;

  select count(*) into v_count from public.test_attempts
  where test_id = p_test_id and member_id = v_member and status <> 'invalidated';
  if t.max_attempts is not null and v_count >= t.max_attempts then
    raise exception 'max_attempts_reached' using errcode = 'P0001';
  end if;

  -- Build the paper: static questions + random pools, section by section.
  with secs as (
    select s.id, s.position, s.question_selection, s.marks_per_question, s.negative_marks
    from public.test_sections s where s.test_id = p_test_id
  ),
  static_q as (
    select tq.question_id as qid, tq.section_id as sid,
           coalesce(s.position, 0) as spos,
           case when t.shuffle_questions then random() else tq.position end as ord,
           coalesce(tq.marks, s.marks_per_question, q.default_marks) as m,
           case when t.negative_marking then coalesce(tq.negative_marks, s.negative_marks, q.default_negative_marks) else 0 end as n
    from public.test_questions tq
    join public.questions q on q.id = tq.question_id
    left join secs s on s.id = tq.section_id
    where tq.test_id = p_test_id
  ),
  random_q as (
    select pick.id as qid, s.id as sid, s.position as spos, random() as ord,
           coalesce(s.marks_per_question, pick.default_marks) as m,
           case when t.negative_marking then coalesce(s.negative_marks, pick.default_negative_marks) else 0 end as n
    from secs s
    cross join lateral (
      select q.id, q.default_marks, q.default_negative_marks
      from public.questions q
      where q.tenant_id = t.tenant_id and q.status = 'approved' and q.deleted_at is null and q.type <> 'passage'
        and (s.question_selection #>> '{filter,subject_term_id}' is null or q.subject_term_id = (s.question_selection #>> '{filter,subject_term_id}')::uuid)
        and (s.question_selection #>> '{filter,topic_term_id}'   is null or q.topic_term_id   = (s.question_selection #>> '{filter,topic_term_id}')::uuid)
        and (s.question_selection #>  '{filter,tags}'            is null or q.tags @> array(select jsonb_array_elements_text(s.question_selection #> '{filter,tags}')))
        and (s.question_selection #>  '{filter,difficulty}'      is null or q.difficulty in (select (jsonb_array_elements_text(s.question_selection #> '{filter,difficulty}'))::smallint))
        and not exists (select 1 from public.test_questions x where x.test_id = p_test_id and x.question_id = q.id)
      order by random()
      limit coalesce((s.question_selection ->> 'count')::int, 0)
    ) pick
    where s.question_selection ->> 'mode' = 'random'
  ),
  allq as (select * from static_q union all select * from random_q)
  select coalesce(jsonb_agg(jsonb_build_object('q', qid, 's', sid, 'm', m, 'n', n) order by spos, ord), '[]'::jsonb),
         coalesce(sum(m), 0)
    into v_paper, v_max
  from allq;

  if jsonb_array_length(v_paper) = 0 then raise exception 'test_has_no_questions' using errcode = 'P0001'; end if;

  v_dead := case when t.duration_seconds is not null then now() + make_interval(secs => t.duration_seconds) end;
  if t.available_until is not null then v_dead := least(coalesce(v_dead, t.available_until), t.available_until); end if;

  insert into public.test_attempts (tenant_id, test_id, member_id, enrollment_id, attempt_no, paper, deadline_at, max_score)
  values (t.tenant_id, p_test_id, v_member, v_enr, v_count + 1, v_paper, v_dead, v_max)
  returning id into v_id;

  insert into public.learning_events (tenant_id, member_id, verb, object_type, object_id, context)
  values (t.tenant_id, v_member, 'test.started', 'test', p_test_id, jsonb_build_object('attempt_id', v_id));
  return v_id;
end $$;

-- The question paper for an open attempt – content only, never keys.
create or replace function public.get_attempt_paper(p_attempt_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  a public.test_attempts;
  t public.tests;
begin
  select at.* into a from public.test_attempts at
  join public.tenant_members m on m.id = at.member_id
  where at.id = p_attempt_id and m.user_id = (select auth.uid());
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.status <> 'in_progress' then raise exception 'attempt_closed' using errcode = 'P0001'; end if;
  select * into t from public.tests where id = a.test_id;

  return jsonb_build_object(
    'attempt_id',  a.id,
    'test',        jsonb_build_object('id', t.id, 'title', t.title, 'instructions', t.instructions, 'settings', t.settings),
    'server_now',  now(),
    'deadline_at', a.deadline_at,
    'sections',    (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'instructions', s.instructions,
                                                                 'duration_seconds', s.duration_seconds) order by s.position), '[]')
                    from public.test_sections s where s.test_id = t.id),
    'questions',   (select jsonb_agg(jsonb_build_object(
                        'id', q.id, 'type', q.type, 'section_id', e ->> 's',
                        'marks', (e ->> 'm')::numeric, 'negative_marks', (e ->> 'n')::numeric,
                        'stem', q.stem, 'translations', q.translations,
                        'passage', (select p.stem from public.questions p where p.id = q.passage_id),
                        'options', case when t.shuffle_options
                                        then (select jsonb_agg(o order by md5(a.id::text || (o ->> 'id'))) from jsonb_array_elements(q.options) o)
                                        else q.options end
                      ) order by ord)
                    from jsonb_array_elements(a.paper) with ordinality as p(e, ord)
                    join public.questions q on q.id = (e ->> 'q')::uuid),
    'answers',     (select coalesce(jsonb_object_agg(aa.question_id, jsonb_build_object('response', aa.response, 'flagged', aa.flagged)), '{}')
                    from public.attempt_answers aa where aa.attempt_id = a.id)
  );
end $$;

create or replace function public.submit_test_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.test_attempts;
  t public.tests;
  v_late boolean;
begin
  select at.* into a from public.test_attempts at
  join public.tenant_members m on m.id = at.member_id
  where at.id = p_attempt_id and m.user_id = (select auth.uid())
  for update of at;
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  select * into t from public.tests where id = a.test_id;

  if a.status = 'in_progress' then
    v_late := a.deadline_at is not null and now() > a.deadline_at + make_interval(secs => t.grace_seconds);
    update public.test_attempts
       set status             = case when v_late then 'auto_submitted' else 'submitted' end,
           submitted_at       = case when v_late then a.deadline_at else now() end,
           time_taken_seconds = extract(epoch from ((case when v_late then a.deadline_at else now() end) - started_at))::int
     where id = a.id;
    perform private.grade_attempt(a.id);
    select * into a from public.test_attempts where id = a.id;
  end if;

  return case when t.result_visibility = 'immediate'
    then jsonb_build_object('status', a.status, 'score', a.score, 'max_score', a.max_score, 'percentage', a.percentage,
                            'correct', a.correct_count, 'incorrect', a.incorrect_count, 'unattempted', a.unattempted_count,
                            'is_passed', a.is_passed, 'pending_manual', a.pending_manual)
    else jsonb_build_object('status', a.status, 'result_visibility', t.result_visibility)
  end;
end $$;

-- Autosave a single answer. Returns server time so the client can correct clock drift.
create or replace function public.save_attempt_answer(
  p_attempt_id   uuid,
  p_question_id  uuid,
  p_response     jsonb,
  p_time_spent   int     default 0,
  p_flagged      boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.test_attempts;
  v_grace int;
begin
  select at.* into a from public.test_attempts at
  join public.tenant_members m on m.id = at.member_id
  where at.id = p_attempt_id and m.user_id = (select auth.uid());
  if not found then raise exception 'attempt_not_found' using errcode = 'P0002'; end if;
  if a.status <> 'in_progress' then return jsonb_build_object('status', 'closed', 'server_now', now()); end if;

  select grace_seconds into v_grace from public.tests where id = a.test_id;
  if a.deadline_at is not null and now() > a.deadline_at + make_interval(secs => v_grace) then
    perform public.submit_test_attempt(p_attempt_id);
    return jsonb_build_object('status', 'closed', 'server_now', now());
  end if;

  if not a.paper @> jsonb_build_array(jsonb_build_object('q', p_question_id)) then
    raise exception 'question_not_in_paper' using errcode = 'P0001';
  end if;
  if pg_column_size(p_response) > 20000 then
    raise exception 'response_too_large' using errcode = 'P0001';
  end if;

  insert into public.attempt_answers as aa (tenant_id, attempt_id, question_id, response, time_spent_seconds, flagged, answered_at)
  values (a.tenant_id, a.id, p_question_id, p_response,
          least(greatest(coalesce(p_time_spent, 0), 0), extract(epoch from (now() - a.started_at))::int),
          coalesce(p_flagged, false), now())
  on conflict (attempt_id, question_id) do update set
    response           = excluded.response,
    time_spent_seconds = greatest(aa.time_spent_seconds, excluded.time_spent_seconds),
    flagged            = excluded.flagged,
    answered_at        = now();

  return jsonb_build_object('status', 'saved', 'server_now', now());
end $$;

-- Cron (every minute): close attempts whose time ran out (browser closed, network lost).
create or replace function private.close_expired_attempts()
returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  for r in
    select a.id from public.test_attempts a join public.tests t on t.id = a.test_id
    where a.status = 'in_progress' and a.deadline_at is not null
      and now() > a.deadline_at + make_interval(secs => t.grace_seconds)
    limit 500
    for update of a skip locked
  loop
    update public.test_attempts set status = 'auto_submitted', submitted_at = deadline_at,
           time_taken_seconds = extract(epoch from (deadline_at - started_at))::int
     where id = r.id;
    perform private.grade_attempt(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Rank & percentile on each learner's BEST graded attempt. Run when a test closes / results publish.
create or replace function private.compute_test_ranks(p_test_id uuid)
returns void
language sql security definer set search_path = '' as $$
  with best as (
    select distinct on (member_id) id, score, time_taken_seconds
    from public.test_attempts
    where test_id = p_test_id and status = 'graded'
    order by member_id, score desc, time_taken_seconds asc nulls last, submitted_at asc
  ),
  ranked as (
    select id,
           rank()         over (order by score desc, time_taken_seconds asc nulls last) as r,
           percent_rank() over (order by score asc) as pr
    from best
  )
  update public.test_attempts a
     set rank = ranked.r, percentile = round((ranked.pr * 100)::numeric, 2)
    from ranked
   where a.id = ranked.id
$$;

-- ===================================================== 7. leaderboards
create or replace function private.refresh_leaderboard(p_leaderboard uuid)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  lb      public.leaderboards;
  v_tz    text;
  v_local timestamp;
  v_start timestamptz;
  v_key   text;
  v_n     int;
begin
  select * into lb from public.leaderboards where id = p_leaderboard and is_active;
  if not found then return 0; end if;
  select timezone into v_tz from public.tenants where id = lb.tenant_id;
  v_local := now() at time zone v_tz;

  v_start := case lb.period
    when 'daily'   then date_trunc('day',   v_local) at time zone v_tz
    when 'weekly'  then date_trunc('week',  v_local) at time zone v_tz
    when 'monthly' then date_trunc('month', v_local) at time zone v_tz
    else null end;
  v_key := case lb.period
    when 'daily'   then to_char(v_local, 'YYYY-MM-DD')
    when 'weekly'  then to_char(v_local, 'IYYY-"W"IW')
    when 'monthly' then to_char(v_local, 'YYYY-MM')
    else 'all' end;

  delete from public.leaderboard_entries where leaderboard_id = lb.id and period_key = v_key;

  with scope_members as (
    select m.id as member_id, m.display_name
    from public.tenant_members m
    where m.tenant_id = lb.tenant_id and m.status = 'active'
      and (lb.scope_type = 'tenant'
        or (lb.scope_type = 'course' and exists (select 1 from public.enrollments e where e.member_id = m.id and e.course_id = lb.scope_id and e.status in ('active', 'completed')))
        or (lb.scope_type = 'batch'  and exists (select 1 from public.enrollments e where e.member_id = m.id and e.batch_id  = lb.scope_id and e.status in ('active', 'completed')))
        or (lb.scope_type = 'branch' and m.branch_id = lb.scope_id)
        or (lb.scope_type = 'test'   and exists (select 1 from public.test_attempts ta where ta.member_id = m.id and ta.test_id = lb.scope_id)))
  ),
  scores as (
    select sm.member_id, sm.display_name,
      case lb.metric
        when 'xp' then case when v_start is null
                            then (select coalesce(s.xp_total, 0)::numeric from public.member_stats s where s.member_id = sm.member_id)
                            else (select coalesce(sum(x.points), 0)::numeric from public.xp_ledger x
                                  where x.tenant_id = lb.tenant_id and x.member_id = sm.member_id and x.occurred_at >= v_start) end
        when 'streak'            then (select s.current_streak::numeric    from public.member_stats s where s.member_id = sm.member_id)
        when 'lessons_completed' then (select s.lessons_completed::numeric from public.member_stats s where s.member_id = sm.member_id)
        when 'test_score'        then (select max(ta.score) from public.test_attempts ta
                                       where ta.member_id = sm.member_id and ta.status = 'graded'
                                         and (lb.scope_type <> 'test' or ta.test_id = lb.scope_id)
                                         and (v_start is null or ta.submitted_at >= v_start))
        else null
      end as score
    from scope_members sm
  ),
  ranked as (
    select member_id, display_name, score, rank() over (order by score desc) as r
    from scores where coalesce(score, 0) > 0
  )
  insert into public.leaderboard_entries (tenant_id, leaderboard_id, period_key, member_id, rank, score, display_name)
  select lb.tenant_id, lb.id, v_key, member_id, r, score,
         case when lb.anonymize then 'Learner #' || r else display_name end
  from ranked where r <= lb.top_n;

  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ===================================================== 8. reporting views
-- security_invoker → the caller's RLS applies to every underlying table.
create or replace view public.v_syllabus_item_status with (security_invoker = true) as
select i.tenant_id, p.batch_id, p.course_id, i.plan_id, i.id as item_id, i.title, i.phase_label,
       i.owner_member_id, i.planned_start, i.planned_end, i.weight,
       coalesce(c.max_pct, 0) as coverage_pct,
       c.last_covered_on,
       c.completed_on,
       case
         when coalesce(c.max_pct, 0) >= 100                              then 'completed'
         when i.planned_end is not null and i.planned_end < current_date then 'delayed'
         when i.planned_start is not null and i.planned_start > current_date then 'upcoming'
         when coalesce(c.max_pct, 0) > 0                                 then 'in_progress'
         else 'due'
       end as status,
       case when c.completed_on is not null and i.planned_end is not null
            then c.completed_on - i.planned_end end as days_late
from public.syllabus_items i
join public.syllabus_plans p on p.id = i.plan_id and p.status = 'active'
left join lateral (
  select max(sc.coverage_pct) as max_pct,
         max(sc.covered_on)   as last_covered_on,
         min(sc.covered_on) filter (where sc.coverage_pct >= 100) as completed_on
  from public.syllabus_coverage sc where sc.item_id = i.id
) c on true;

-- Faculty progress: what they should have covered by today vs what they did.
create or replace view public.v_instructor_syllabus_progress with (security_invoker = true) as
select tenant_id, batch_id, course_id, owner_member_id,
       count(*)                                                    as items_total,
       count(*) filter (where status = 'completed')                as items_completed,
       count(*) filter (where status = 'delayed')                  as items_delayed,
       round(100 * sum(weight * coverage_pct / 100.0) / nullif(sum(weight), 0), 1) as actual_pct,
       round(100 * sum(weight) filter (where planned_end <= current_date) / nullif(sum(weight), 0), 1) as expected_pct,
       round(100 * sum(weight * coverage_pct / 100.0) / nullif(sum(weight), 0), 1)
         - coalesce(round(100 * sum(weight) filter (where planned_end <= current_date) / nullif(sum(weight), 0), 1), 0) as schedule_variance_pct
from public.v_syllabus_item_status
group by tenant_id, batch_id, course_id, owner_member_id;

create or replace view public.v_enrollment_overview with (security_invoker = true) as
select e.id as enrollment_id, e.tenant_id, e.member_id, e.course_id, e.batch_id, e.status,
       e.started_at, e.expires_at, e.completed_at, e.progress_pct, e.lessons_completed, e.lessons_total,
       e.total_time_seconds, e.last_activity_at,
       (current_date - e.started_at::date)                                  as days_enrolled,
       case when e.expires_at is not null then greatest(e.expires_at::date - current_date, 0) end as days_remaining,
       (select count(*) from public.daily_activity d
         where d.member_id = e.member_id and d.day >= e.started_at::date)   as active_days,
       (current_date - e.last_activity_at::date)                            as days_since_active
from public.enrollments e;

-- ===================================================== 9. triggers
create or replace function private.maintain_course_lesson_count()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_course uuid := coalesce(new.course_id, old.course_id);
begin
  update public.courses c set lesson_count = (
    select count(*) from public.lessons l
    where l.course_id = v_course and l.is_published and l.is_mandatory and l.deleted_at is null
  ) where c.id = v_course;
  return null;
end $$;
create trigger lessons_count_trg after insert or delete or update of is_published, is_mandatory, deleted_at, course_id
  on public.lessons for each row execute function private.maintain_course_lesson_count();

create or replace function private.xp_to_member_stats()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_day date;
begin
  insert into public.member_stats as s (tenant_id, member_id, xp_total)
  values (new.tenant_id, new.member_id, greatest(new.points, 0))
  on conflict (member_id) do update set xp_total = greatest(s.xp_total + new.points, 0), updated_at = now();

  update public.member_stats s
     set level_id = (select l.id from public.levels l
                     where l.tenant_id = new.tenant_id and l.min_xp <= s.xp_total
                     order by l.min_xp desc limit 1)
   where s.member_id = new.member_id;

  select (now() at time zone t.timezone)::date into v_day from public.tenants t where t.id = new.tenant_id;
  insert into public.daily_activity as d (tenant_id, member_id, day, xp_earned)
  values (new.tenant_id, new.member_id, v_day, new.points)
  on conflict (tenant_id, member_id, day) do update set xp_earned = d.xp_earned + excluded.xp_earned;
  return null;
end $$;
create trigger xp_ledger_stats_trg after insert on public.xp_ledger
  for each row execute function private.xp_to_member_stats();

create or replace function private.badge_awarded()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_xp int;
begin
  insert into public.member_stats as s (tenant_id, member_id, badges_count) values (new.tenant_id, new.member_id, 1)
  on conflict (member_id) do update set badges_count = s.badges_count + 1, updated_at = now();
  select xp_reward into v_xp from public.badges where id = new.badge_id;
  perform private.award_xp(new.tenant_id, new.member_id, coalesce(v_xp, 0), 'badge.awarded', 'badge', new.badge_id,
                           'badge:' || new.badge_id || ':' || new.member_id);
  insert into public.outbox_events (tenant_id, event_type, aggregate_type, aggregate_id, payload)
  values (new.tenant_id, 'badge.awarded', 'badge', new.badge_id, jsonb_build_object('member_id', new.member_id));
  return null;
end $$;
create trigger member_badges_trg after insert on public.member_badges
  for each row execute function private.badge_awarded();

create or replace function private.discussion_post_counters()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.discussion_threads
     set replies_count    = replies_count + 1,
         last_activity_at = now(),
         status           = case when new.is_staff_answer and status = 'open' then 'answered' else status end
   where id = new.thread_id;
  return null;
end $$;
create trigger discussion_posts_counter_trg after insert on public.discussion_posts
  for each row execute function private.discussion_post_counters();

create or replace function private.vote_counters()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_type text := coalesce(new.target_type, old.target_type);
        v_id   uuid := coalesce(new.target_id, old.target_id);
        v_diff int  := coalesce(new.value, 0) - coalesce(old.value, 0);
begin
  if v_type = 'thread' then
    update public.discussion_threads set upvotes = upvotes + v_diff where id = v_id;
  elsif v_type = 'post' then
    update public.discussion_posts set upvotes = upvotes + v_diff where id = v_id;
  end if;
  return null;
end $$;
create trigger votes_counter_trg after insert or update or delete on public.votes
  for each row execute function private.vote_counters();

-- Plan limits (hard). Soft limits (warnings at 80%) are handled in the app.
create trigger courses_limit_trg  before insert on public.courses
  for each row execute function private.enforce_count_limit('limit.courses', 'deleted_at is null');
create trigger members_limit_trg  before insert on public.tenant_members
  for each row execute function private.enforce_count_limit('limit.members', 'status in (''active'',''invited'')');
create trigger branches_limit_trg before insert on public.branches
  for each row execute function private.enforce_count_limit('limit.branches', 'is_active');

-- Generic audit trail for sensitive configuration & money tables.
create or replace function private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changes jsonb;
begin
  select jsonb_object_agg(k, jsonb_build_array(v_old -> k, v_new -> k)) into v_changes
  from jsonb_object_keys(v_row) as k
  where (v_old -> k) is distinct from (v_new -> k)
    and k not in ('updated_at', 'secret_vault_id', 'webhook_secret_vault_id', 'key_hash', 'token_hash');

  insert into public.audit_logs (tenant_id, actor_user_id, action, entity_type, entity_id, changes, impersonated_by)
  values ((v_row ->> 'tenant_id')::uuid,
          (select auth.uid()),
          tg_table_name || '.' || lower(tg_op),
          tg_table_name,
          private.try_uuid(v_row ->> 'id'),
          v_changes,
          private.try_uuid(current_setting('request.jwt.claims', true)::jsonb ->> 'impersonator_id'));
  return null;
end $$;

create or replace function private.try_uuid(t text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return t::uuid;
exception when others then
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['roles', 'role_permissions', 'member_roles', 'tenant_modules', 'tenant_branding', 'tenant_settings',
                           'payment_gateway_accounts', 'prices', 'coupons', 'payments', 'refunds', 'orders',
                           'tests', 'question_keys', 'api_keys', 'webhook_endpoints', 'integrations', 'tenant_members']
  loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row()',
                   t || '_audit_trg', t);
  end loop;
end $$;

-- Control plane: re-resolve entitlements when a tenant's commercial state changes.
create or replace function control.entitlement_source_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform control.refresh_entitlements(coalesce(new.tenant_id, old.tenant_id));
  return null;
end $$;
create trigger tenant_overrides_refresh_trg after insert or update or delete on control.tenant_feature_overrides
  for each row execute function control.entitlement_source_changed();
create trigger tenant_subscriptions_refresh_trg after insert or update of plan_id, status or delete on control.tenant_subscriptions
  for each row execute function control.entitlement_source_changed();
create trigger tenant_addons_refresh_trg after insert or update or delete on control.tenant_addons
  for each row execute function control.entitlement_source_changed();

-- Plan edits fan out to many tenants → async via outbox (worker refreshes in batches).
create or replace function control.plan_features_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into control.outbox_events (event_type, payload)
  values ('plan.features_changed', jsonb_build_object('plan_id', coalesce(new.plan_id, old.plan_id)));
  return null;
end $$;
create trigger plan_features_changed_trg after insert or update or delete on control.plan_features
  for each row execute function control.plan_features_changed();

-- updated_at on every table that has the column.
do $$
declare r record;
begin
  for r in
    select c.table_schema, c.table_name
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.column_name = 'updated_at' and c.table_schema in ('public', 'control')
  loop
    execute format('create trigger set_updated_at before update on %I.%I for each row execute function private.set_updated_at()',
                   r.table_schema, r.table_name);
  end loop;
end $$;
