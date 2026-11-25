-- =============================================================================
-- a0_engagement.sql  —  badges, certificates, leaderboards, email outbox
-- Added in Phase 1 slice 7. XP, levels and streaks already existed (90_functions.sql); what was missing:
--   * nothing awarded badges: private.evaluate_badges() reads each badge's `criteria` and awards it
--   * nothing issued certificates: a trigger on enrollments issues one when a course is completed
--   * nothing refreshed a leaderboard: get_leaderboard() refreshes a stale one on read
--   * nothing consumed the outbox: claim/finish functions for the email worker, plus email templates
-- Badge criteria understood: {"event":"lesson.completed","count":N,"where":{"lesson_type":"…"}},
--   {"event":"course.completed","count":N}, {"event":"test.graded","count":N,"where":{"percentage_gte":P,"test_kind":"…"}},
--   {"metric":"current_streak"|"longest_streak"|"lessons_completed"|"xp_total","gte":N}.   (current_streak is judged by the best streak.)
-- =============================================================================

create or replace function private.badge_criteria_met(p_criteria jsonb, p_member uuid)
returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_need int := greatest(coalesce((p_criteria ->> 'count')::int, 1), 1);
  v_n    int;
  v_gte  numeric := (p_criteria ->> 'gte')::numeric;
begin
  if p_criteria is null then return false; end if;

  if p_criteria ? 'metric' then
    return coalesce((select case p_criteria ->> 'metric'
        when 'current_streak'    then s.longest_streak
        when 'longest_streak'    then s.longest_streak
        when 'lessons_completed' then s.lessons_completed
        when 'xp_total'          then s.xp_total
        end >= v_gte
      from public.member_stats s where s.member_id = p_member), false);
  end if;

  case p_criteria ->> 'event'
    when 'lesson.completed' then
      select count(*) into v_n from public.learning_events e
        left join public.lessons l on l.id = e.object_id
       where e.member_id = p_member and e.verb = 'lesson.completed'
         and (p_criteria #>> '{where,lesson_type}' is null or l.type = p_criteria #>> '{where,lesson_type}');
    when 'course.completed' then
      select count(*) into v_n from public.learning_events e where e.member_id = p_member and e.verb = 'course.completed';
    when 'test.graded' then
      select count(*) into v_n from public.test_attempts a join public.tests t on t.id = a.test_id
       where a.member_id = p_member and a.status = 'graded'
         and (p_criteria #>> '{where,percentage_gte}' is null or a.percentage >= (p_criteria #>> '{where,percentage_gte}')::numeric)
         and (p_criteria #>> '{where,test_kind}' is null or t.kind = p_criteria #>> '{where,test_kind}');
    else
      return false;
  end case;
  return v_n >= v_need;
end $$;

create or replace function private.evaluate_badges(p_tenant uuid, p_member uuid)
returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  if not private.feature_enabled(p_tenant, 'engage.badges') then return 0; end if;
  for r in
    select b.id from public.badges b
    where b.tenant_id = p_tenant and b.is_active and b.criteria is not null
      and not exists (select 1 from public.member_badges mb where mb.badge_id = b.id and mb.member_id = p_member)
  loop
    if private.badge_criteria_met((select criteria from public.badges where id = r.id), p_member) then
      insert into public.member_badges (tenant_id, badge_id, member_id) values (p_tenant, r.id, p_member) on conflict do nothing;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

create or replace function private.learning_event_badges()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.verb in ('lesson.completed', 'course.completed', 'test.graded') then
    perform private.evaluate_badges(new.tenant_id, new.member_id);
  end if;
  return null;
end $$;
create trigger learning_events_badges_trg after insert on public.learning_events
  for each row execute function private.learning_event_badges();

create or replace function private.streak_badges()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.evaluate_badges(new.tenant_id, new.member_id);
  return null;
end $$;
create trigger member_stats_badges_trg after insert or update of longest_streak on public.member_stats
  for each row execute function private.streak_badges();

-- ------------------------------------------------------------------ certificates
create or replace function private.issue_certificate(p_enrollment uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  e public.enrollments; c public.courses; m public.tenant_members; v_id uuid;
begin
  select * into e from public.enrollments where id = p_enrollment;
  if not found or e.certificate_id is not null then return e.certificate_id; end if;
  if not private.feature_enabled(e.tenant_id, 'learning.certificates') then return null; end if;
  select * into c from public.courses where id = e.course_id;
  if coalesce(c.settings ->> 'certificate', 'true') = 'false' then return null; end if;
  select * into m from public.tenant_members where id = e.member_id;
  if exists (select 1 from public.certificates x where x.enrollment_id = e.id) then return null; end if;

  insert into public.certificates (tenant_id, member_id, course_id, enrollment_id, serial_no, verification_code, recipient_name, title, data)
  values (e.tenant_id, e.member_id, e.course_id, e.id,
          'CERT-' || to_char(now(), 'YYYY') || '-' || lpad(private.next_counter(e.tenant_id, 'certificate')::text, 6, '0'),
          upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
          m.display_name, c.title, jsonb_build_object('course_slug', c.slug, 'completed_at', e.completed_at))
  returning id into v_id;
  update public.enrollments set certificate_id = v_id where id = e.id;
  insert into public.outbox_events (tenant_id, event_type, aggregate_type, aggregate_id, payload)
  values (e.tenant_id, 'certificate.issued', 'certificate', v_id, jsonb_build_object('member_id', e.member_id, 'course_title', c.title));
  return v_id;
end $$;

-- A completed course is an event of its own (badges count it) and earns the certificate.
create or replace function private.enrollment_completed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.learning_events (tenant_id, member_id, verb, object_type, object_id, context)
  values (new.tenant_id, new.member_id, 'course.completed', 'course', new.course_id, jsonb_build_object('enrollment_id', new.id));
  perform private.issue_certificate(new.id);
  return null;
end $$;
create trigger enrollments_completed_trg after update of completed_at on public.enrollments
  for each row when (old.completed_at is null and new.completed_at is not null)
  execute function private.enrollment_completed();

create or replace function public.revoke_certificate(p_certificate_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare c public.certificates;
begin
  select * into c from public.certificates where id = p_certificate_id;
  if not found then raise exception 'certificate_not_found' using errcode = 'P0002'; end if;
  if not private.has_perm(c.tenant_id, 'certificate.manage') then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.certificates set revoked_at = coalesce(revoked_at, now()), revoke_reason = nullif(trim(coalesce(p_reason, '')), '') where id = c.id;
end $$;

-- ------------------------------------------------------------------ leaderboards
-- Refreshes a stale board (older than a minute) and returns its top rows plus the caller's own place.
create or replace function public.get_leaderboard(p_key text, p_limit int default 10)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  lb       public.leaderboards;
  v_member uuid;
  v_period text;
  v_age    timestamptz;
begin
  select lb2.* into lb from public.leaderboards lb2
   where lb2.key = p_key and lb2.is_active and lb2.is_public and lb2.tenant_id in (select private.feature_tenants('engage.leaderboards'));
  if not found then return null; end if;
  select m.id into v_member from public.tenant_members m where m.tenant_id = lb.tenant_id and m.user_id = (select auth.uid()) and m.status = 'active';
  if v_member is null then return null; end if;

  select max(computed_at) into v_age from public.leaderboard_entries where leaderboard_id = lb.id;
  if v_age is null or v_age < now() - interval '1 minute' then perform private.refresh_leaderboard(lb.id); end if;
  select period_key into v_period from public.leaderboard_entries where leaderboard_id = lb.id order by computed_at desc limit 1;

  return jsonb_build_object(
    'key', lb.key, 'name', lb.name, 'period', lb.period, 'metric', lb.metric,
    'entries', coalesce((select jsonb_agg(jsonb_build_object('rank', x.rank, 'score', x.score, 'name', x.display_name, 'me', x.member_id = v_member) order by x.rank)
                           from (select * from public.leaderboard_entries e where e.leaderboard_id = lb.id and e.period_key = v_period order by e.rank limit greatest(least(p_limit, 50), 3)) x), '[]'::jsonb),
    'me', (select jsonb_build_object('rank', e.rank, 'score', e.score) from public.leaderboard_entries e where e.leaderboard_id = lb.id and e.period_key = v_period and e.member_id = v_member));
end $$;

-- ------------------------------------------------------------------ email outbox (service role only)
create or replace function public.claim_outbox_events(p_limit int default 20)
returns setof public.outbox_events
language sql security definer set search_path = '' as $$
  update public.outbox_events o
     set attempts = o.attempts + 1, available_at = now() + interval '10 minutes'
   where o.id in (select x.id from public.outbox_events x
                   where x.published_at is null and x.available_at <= now() and x.attempts < 6
                   order by x.created_at limit greatest(least(p_limit, 100), 1) for update skip locked)
  returning o.*
$$;

create or replace function public.finish_outbox_event(p_id uuid, p_error text default null)
returns void
language sql security definer set search_path = '' as $$
  update public.outbox_events
     set published_at = case when p_error is null or attempts >= 6 then now() end,
         last_error   = left(p_error, 500),
         available_at = case when p_error is null then available_at else now() + (attempts * interval '2 minutes') end
   where id = p_id
$$;

revoke execute on function public.claim_outbox_events(int), public.finish_outbox_event(uuid, text) from public, anon, authenticated;
grant  execute on function public.claim_outbox_events(int), public.finish_outbox_event(uuid, text) to service_role;
revoke execute on function public.revoke_certificate(uuid, text), public.get_leaderboard(text, int) from public, anon;
grant  execute on function public.revoke_certificate(uuid, text), public.get_leaderboard(text, int) to authenticated;
revoke execute on function private.badge_criteria_met(jsonb, uuid), private.evaluate_badges(uuid, uuid), private.issue_certificate(uuid) from public;

-- ------------------------------------------------------------------ email templates
-- Plain text with {{variables}}; rendered by the app. Copied to every existing academy (new ones copy them at bootstrap).
insert into public.notification_templates (tenant_id, event_key, channel, subject, body) values
  (null, 'order.receipt',       'email', 'Your receipt from {{tenant.name}}',
   E'Hi {{member.name}},\n\nThank you for your purchase. Your payment of {{order.total}} for {{order.items}} was received.\n\nOrder {{order.no}}\nReceipt: {{links.receipt}}\n\nStart learning: {{links.learn}}'),
  (null, 'order.refunded',      'email', 'Your refund from {{tenant.name}}',
   E'Hi {{member.name}},\n\nWe have refunded {{refund.amount}} for order {{order.no}}. It can take a few business days to show in your account.\n\nReceipt and refund details: {{links.receipt}}'),
  (null, 'certificate.issued',  'email', 'Your certificate for {{course.title}}',
   E'Hi {{member.name}},\n\nCongratulations on completing {{course.title}}. Your certificate is ready.\n\nView and print it: {{links.certificate}}\nAnyone can verify it here: {{links.verify}}')
on conflict do nothing;
insert into public.notification_templates (tenant_id, event_key, channel, subject, body)
select t.id, g.event_key, g.channel, g.subject, g.body
from public.tenants t cross join public.notification_templates g
where g.tenant_id is null and g.event_key in ('order.receipt', 'order.refunded', 'certificate.issued')
on conflict do nothing;
