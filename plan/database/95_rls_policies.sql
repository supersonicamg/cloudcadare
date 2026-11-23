-- =============================================================================
-- 95_rls_policies.sql
-- Row Level Security + grants for the data plane.
--
-- MODEL
--   * Default deny: RLS ON for every table, ALL privileges revoked from anon &
--     authenticated, then granted back table by table.
--   * `anon` gets NOTHING. Public pages (homepage, catalog, course pages) are
--     rendered on the server through the DAL with explicit tenant filters and
--     cached; the browser never queries the DB anonymously.
--   * `authenticated` = a signed-in person. Each policy answers "which tenant's
--     rows, and which of them, may this person see/change?".
--   * Sensitive writes (payments, grades, progress, XP, roles, members) are NOT
--     granted at all → only SECURITY DEFINER RPCs or server code with the
--     secret key (after DAL authorization) can perform them.
--
-- ACCESS CLASSES (helper procedures below generate the standard policies)
--   member_read_staff_write : tenant members read (optionally filtered), perm holders write
--   staff_only              : perm holders read; optional perm write
--   owner_read              : learner reads own rows; staff with perm read all; no client writes
--   owner_write             : learner fully manages own rows (notes, preferences)
-- =============================================================================

-- ------------------------------------------------------------ reset privileges
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public;
revoke all on all functions in schema control from public, anon, authenticated;

do $$
declare r record;
begin
  for r in select schemaname, tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I.%I enable row level security', r.schemaname, r.tablename);
  end loop;
end $$;

-- Helpers used inside policies must be executable by `authenticated`.
grant execute on function
  private.my_member_ids(), private.my_tenant_ids(), private.perm_tenants(text),
  private.perm_scopes(text, text), private.has_perm(uuid, text),
  private.my_course_ids(), private.my_batch_ids(), private.feature_tenants(text),
  private.uuid7()
to authenticated;

-- ------------------------------------------------------------ policy builders
create or replace procedure private.rls_member_read_staff_write(
  p_table text, p_write_perm text, p_member_filter text default 'true', p_staff_read_perm text default null)
language plpgsql set search_path = '' as $$
declare v_read text := coalesce(p_staff_read_perm, p_write_perm);
begin
  execute format($f$create policy %I on public.%I for select to authenticated using (
      (tenant_id in (select private.my_tenant_ids()) and (%s))
      or tenant_id in (select private.perm_tenants(%L)))$f$, p_table || '_select', p_table, p_member_filter, v_read);
  execute format($f$create policy %I on public.%I for insert to authenticated
      with check (tenant_id in (select private.perm_tenants(%L)))$f$, p_table || '_insert', p_table, p_write_perm);
  execute format($f$create policy %I on public.%I for update to authenticated
      using (tenant_id in (select private.perm_tenants(%L)))
      with check (tenant_id in (select private.perm_tenants(%L)))$f$, p_table || '_update', p_table, p_write_perm, p_write_perm);
  execute format($f$create policy %I on public.%I for delete to authenticated
      using (tenant_id in (select private.perm_tenants(%L)))$f$, p_table || '_delete', p_table, p_write_perm);
  execute format('grant select, insert, update, delete on public.%I to authenticated', p_table);
end $$;

create or replace procedure private.rls_staff_only(p_table text, p_read_perm text, p_write_perm text default null)
language plpgsql set search_path = '' as $$
begin
  execute format($f$create policy %I on public.%I for select to authenticated
      using (tenant_id in (select private.perm_tenants(%L)))$f$, p_table || '_select', p_table, p_read_perm);
  execute format('grant select on public.%I to authenticated', p_table);
  if p_write_perm is not null then
    execute format($f$create policy %I on public.%I for insert to authenticated
        with check (tenant_id in (select private.perm_tenants(%L)))$f$, p_table || '_insert', p_table, p_write_perm);
    execute format($f$create policy %I on public.%I for update to authenticated
        using (tenant_id in (select private.perm_tenants(%L)))
        with check (tenant_id in (select private.perm_tenants(%L)))$f$, p_table || '_update', p_table, p_write_perm, p_write_perm);
    execute format($f$create policy %I on public.%I for delete to authenticated
        using (tenant_id in (select private.perm_tenants(%L)))$f$, p_table || '_delete', p_table, p_write_perm);
    execute format('grant insert, update, delete on public.%I to authenticated', p_table);
  end if;
end $$;

create or replace procedure private.rls_owner_read(p_table text, p_staff_perm text, p_owner_col text default 'member_id')
language plpgsql set search_path = '' as $$
begin
  execute format($f$create policy %I on public.%I for select to authenticated using (
      %I in (select private.my_member_ids())
      or tenant_id in (select private.perm_tenants(%L)))$f$, p_table || '_select', p_table, p_owner_col, p_staff_perm);
  execute format('grant select on public.%I to authenticated', p_table);
end $$;

create or replace procedure private.rls_owner_write(p_table text, p_owner_col text default 'member_id')
language plpgsql set search_path = '' as $$
begin
  execute format($f$create policy %I on public.%I for all to authenticated
      using (%I in (select private.my_member_ids()))
      with check (%I in (select private.my_member_ids()))$f$, p_table || '_owner_all', p_table, p_owner_col, p_owner_col);
  execute format('grant select, insert, update, delete on public.%I to authenticated', p_table);
end $$;

-- ================================================================ tenancy
create policy tenants_select on public.tenants for select to authenticated
  using (id in (select private.my_tenant_ids()));
grant select on public.tenants to authenticated;

call private.rls_member_read_staff_write('tenant_entitlements', 'tenant.modules.manage');
-- entitlements are written only by the sync worker: drop client write paths again
drop policy tenant_entitlements_insert on public.tenant_entitlements;
drop policy tenant_entitlements_update on public.tenant_entitlements;
drop policy tenant_entitlements_delete on public.tenant_entitlements;
revoke insert, update, delete on public.tenant_entitlements from authenticated;

-- tenant admin can only toggle modules that are entitled and tenant-toggleable
create policy tenant_modules_select on public.tenant_modules for select to authenticated
  using (tenant_id in (select private.my_tenant_ids()));
create policy tenant_modules_write on public.tenant_modules for all to authenticated
  using (tenant_id in (select private.perm_tenants('tenant.modules.manage')))
  with check (
    tenant_id in (select private.perm_tenants('tenant.modules.manage'))
    and exists (select 1 from public.tenant_entitlements e
                where e.tenant_id = tenant_modules.tenant_id and e.feature_key = tenant_modules.feature_key and e.enabled));
grant select, insert, update, delete on public.tenant_modules to authenticated;

call private.rls_member_read_staff_write('tenant_branding', 'tenant.branding.manage');
call private.rls_member_read_staff_write('tenant_settings', 'tenant.settings.manage');
call private.rls_member_read_staff_write('branches', 'branch.manage');
call private.rls_member_read_staff_write('custom_field_definitions', 'tenant.settings.manage');
call private.rls_member_read_staff_write('taxonomy_terms', 'course.manage');
-- tenant_counters: no policies, no grants (definer functions only)

-- ================================================================ people
call private.rls_owner_read('tenant_members', 'member.view', 'id');
-- learners can edit a few of their own profile fields (column-level grant + policy)
create policy tenant_members_self_update on public.tenant_members for update to authenticated
  using (id in (select private.my_member_ids())) with check (id in (select private.my_member_ids()));
grant update (display_name, avatar_path, locale) on public.tenant_members to authenticated;

create policy permission_catalog_select on public.permission_catalog for select to authenticated using (true);
grant select on public.permission_catalog to authenticated;

call private.rls_staff_only('roles', 'member.view');
call private.rls_staff_only('role_permissions', 'role.manage');
call private.rls_owner_read('member_roles', 'member.view');
call private.rls_staff_only('invitations', 'member.invite');

create policy guardian_links_select on public.guardian_links for select to authenticated using (
  guardian_member_id in (select private.my_member_ids())
  or student_member_id in (select private.my_member_ids())
  or tenant_id in (select private.perm_tenants('guardian.manage')));
grant select on public.guardian_links to authenticated;

call private.rls_member_read_staff_write('instructor_profiles', 'member.manage', 'is_public');
create policy instructor_profiles_self_update on public.instructor_profiles for update to authenticated
  using (member_id in (select private.my_member_ids())) with check (member_id in (select private.my_member_ids()));

call private.rls_owner_read('member_devices', 'member.manage');
call private.rls_owner_read('consents', 'member.manage');
call private.rls_owner_read('data_subject_requests', 'member.manage');
call private.rls_staff_only('media_assets', 'content.upload', 'content.upload');

-- ================================================================ catalog & content
call private.rls_member_read_staff_write('courses', 'course.manage',
  $$status = 'published' and deleted_at is null$$, 'course.view_all');
call private.rls_member_read_staff_write('course_instructors', 'course.manage');
call private.rls_member_read_staff_write('course_sections', 'course.manage',
  $$is_published and deleted_at is null$$, 'course.view_all');
-- Lesson CONTENT only for enrolled learners or free previews. (Public outlines are rendered server-side.)
call private.rls_member_read_staff_write('lessons', 'course.manage',
  $$is_published and deleted_at is null and (is_preview or course_id in (select private.my_course_ids()))$$, 'course.view_all');
call private.rls_member_read_staff_write('lesson_resources', 'course.manage',
  $$lesson_id in (select l.id from public.lessons l)$$, 'course.view_all');

call private.rls_member_read_staff_write('batches', 'batch.manage');
call private.rls_member_read_staff_write('batch_courses', 'batch.manage');
call private.rls_member_read_staff_write('batch_instructors', 'batch.manage');
call private.rls_member_read_staff_write('batch_content_releases', 'batch.manage',
  $$batch_id in (select private.my_batch_ids())$$);

call private.rls_member_read_staff_write('live_sessions', 'live.manage',
  $$(batch_id in (select private.my_batch_ids()) or course_id in (select private.my_course_ids()))$$);
-- batch-scoped faculty manage their own batches' sessions
create policy live_sessions_scoped_all on public.live_sessions for all to authenticated
  using ((tenant_id, batch_id) in (select s.tenant_id, s.scope_id from private.perm_scopes('live.host', 'batch') s))
  with check ((tenant_id, batch_id) in (select s.tenant_id, s.scope_id from private.perm_scopes('live.host', 'batch') s));
create policy live_sessions_host_select on public.live_sessions for select to authenticated
  using (host_member_id in (select private.my_member_ids()));

call private.rls_staff_only('live_session_hosts', 'live.manage');
create policy live_session_hosts_host_select on public.live_session_hosts for select to authenticated
  using (session_id in (select ls.id from public.live_sessions ls where ls.host_member_id in (select private.my_member_ids())));

call private.rls_owner_read('attendance_records', 'attendance.view');
create policy attendance_mark_tenant on public.attendance_records for all to authenticated
  using (tenant_id in (select private.perm_tenants('attendance.mark')))
  with check (tenant_id in (select private.perm_tenants('attendance.mark')));
create policy attendance_mark_scoped on public.attendance_records for all to authenticated
  using (live_session_id in (select ls.id from public.live_sessions ls
         where (ls.tenant_id, ls.batch_id) in (select s.tenant_id, s.scope_id from private.perm_scopes('attendance.mark', 'batch') s)))
  with check (live_session_id in (select ls.id from public.live_sessions ls
         where (ls.tenant_id, ls.batch_id) in (select s.tenant_id, s.scope_id from private.perm_scopes('attendance.mark', 'batch') s)));
grant insert, update, delete on public.attendance_records to authenticated;

call private.rls_member_read_staff_write('syllabus_plans', 'syllabus.manage');
call private.rls_member_read_staff_write('syllabus_items', 'syllabus.manage');
call private.rls_member_read_staff_write('syllabus_coverage', 'syllabus.update_coverage');
create policy syllabus_coverage_scoped on public.syllabus_coverage for insert to authenticated
  with check (item_id in (select i.id from public.syllabus_items i join public.syllabus_plans p on p.id = i.plan_id
               where (p.tenant_id, p.batch_id) in (select s.tenant_id, s.scope_id from private.perm_scopes('syllabus.update_coverage', 'batch') s)
                  or i.owner_member_id in (select private.my_member_ids())));

-- ================================================================ learning
call private.rls_owner_read('enrollments', 'enrollment.view');
call private.rls_owner_read('lesson_progress', 'progress.view');
call private.rls_owner_write('lesson_notes');
call private.rls_owner_read('daily_activity', 'progress.view');
call private.rls_staff_only('learning_events', 'report.view');
call private.rls_staff_only('certificate_templates', 'certificate.manage', 'certificate.manage');
call private.rls_owner_read('certificates', 'certificate.manage');

-- ================================================================ assessments
call private.rls_staff_only('questions', 'question.view', 'question.manage');
call private.rls_staff_only('question_keys', 'question.manage', 'question.manage');
call private.rls_staff_only('question_stats', 'question.view');
call private.rls_member_read_staff_write('tests', 'test.manage',
  $$status in ('published', 'closed') and deleted_at is null$$);
call private.rls_member_read_staff_write('test_sections', 'test.manage',
  $$test_id in (select t.id from public.tests t)$$);
call private.rls_staff_only('test_questions', 'test.manage', 'test.manage');
-- attempts & answers: learners go through RPCs / server DAL (result & answer visibility rules)
call private.rls_staff_only('test_attempts', 'result.view');
call private.rls_staff_only('attempt_answers', 'test.grade');
call private.rls_member_read_staff_write('assignments', 'assignment.manage',
  $$status in ('published', 'closed') and (course_id in (select private.my_course_ids()) or batch_id in (select private.my_batch_ids()))$$);
call private.rls_owner_read('assignment_submissions', 'assignment.grade');

-- ================================================================ engagement
call private.rls_owner_read('xp_ledger', 'gamification.manage');
call private.rls_member_read_staff_write('levels', 'gamification.manage');
call private.rls_owner_read('member_stats', 'progress.view');
call private.rls_member_read_staff_write('badges', 'gamification.manage', $$is_active and not is_secret$$);
call private.rls_member_read_staff_write('member_badges', 'gamification.manage');
call private.rls_member_read_staff_write('leaderboards', 'gamification.manage',
  $$is_public and is_active and tenant_id in (select private.feature_tenants('engage.leaderboards'))$$);
create policy leaderboard_entries_select on public.leaderboard_entries for select to authenticated
  using (leaderboard_id in (select lb.id from public.leaderboards lb));
grant select on public.leaderboard_entries to authenticated;

-- Discussions: members see discussions in contexts they can access; doubts are private
-- to the author and doubt-answering staff.
create policy discussion_threads_select on public.discussion_threads for select to authenticated using (
  (tenant_id in (select private.feature_tenants('engage.discussions')) and status <> 'hidden' and (
      (kind = 'discussion' and (context_type = 'general'
                                or (context_type = 'course' and context_id in (select private.my_course_ids()))
                                or (context_type = 'batch'  and context_id in (select private.my_batch_ids()))))
   or author_member_id in (select private.my_member_ids())))
  or tenant_id in (select private.perm_tenants('doubt.answer'))
  or tenant_id in (select private.perm_tenants('discussion.moderate')));
create policy discussion_threads_insert on public.discussion_threads for insert to authenticated
  with check (author_member_id in (select private.my_member_ids()) and status = 'open' and not is_pinned and upvotes = 0 and replies_count = 0);
create policy discussion_threads_update_own on public.discussion_threads for update to authenticated
  using (author_member_id in (select private.my_member_ids()) and status = 'open')
  with check (author_member_id in (select private.my_member_ids()));
create policy discussion_threads_moderate on public.discussion_threads for all to authenticated
  using (tenant_id in (select private.perm_tenants('discussion.moderate')))
  with check (tenant_id in (select private.perm_tenants('discussion.moderate')));
grant select, insert, delete on public.discussion_threads to authenticated;
-- learners edit their own text only; moderation (status, pin, assign) runs server-side under discussion.moderate
grant update (title, body, attachments) on public.discussion_threads to authenticated;

create policy discussion_posts_select on public.discussion_posts for select to authenticated
  using (thread_id in (select t.id from public.discussion_threads t) and (status = 'visible' or author_member_id in (select private.my_member_ids())));
create policy discussion_posts_insert on public.discussion_posts for insert to authenticated
  with check (author_member_id in (select private.my_member_ids())
              and thread_id in (select t.id from public.discussion_threads t where t.status in ('open', 'answered'))
              and upvotes = 0 and not is_accepted_answer
              and (not is_staff_answer or tenant_id in (select private.perm_tenants('doubt.answer'))));
create policy discussion_posts_update_own on public.discussion_posts for update to authenticated
  using (author_member_id in (select private.my_member_ids())) with check (author_member_id in (select private.my_member_ids()));
create policy discussion_posts_moderate on public.discussion_posts for all to authenticated
  using (tenant_id in (select private.perm_tenants('discussion.moderate')))
  with check (tenant_id in (select private.perm_tenants('discussion.moderate')));
grant select, insert on public.discussion_posts to authenticated;
grant update (body, attachments) on public.discussion_posts to authenticated;

call private.rls_owner_write('votes');
create policy content_reports_insert on public.content_reports for insert to authenticated
  with check (reporter_id in (select private.my_member_ids()));
create policy content_reports_select on public.content_reports for select to authenticated
  using (tenant_id in (select private.perm_tenants('discussion.moderate')) or reporter_id in (select private.my_member_ids()));
grant select, insert on public.content_reports to authenticated;

create policy reviews_select on public.reviews for select to authenticated using (
  (tenant_id in (select private.my_tenant_ids()) and status = 'published')
  or member_id in (select private.my_member_ids())
  or tenant_id in (select private.perm_tenants('review.moderate')));
create policy reviews_insert on public.reviews for insert to authenticated
  with check (member_id in (select private.my_member_ids()) and course_id in (select private.my_course_ids()) and status = 'pending' and reply is null);
create policy reviews_update_own on public.reviews for update to authenticated
  using (member_id in (select private.my_member_ids())) with check (member_id in (select private.my_member_ids()));
grant select, insert on public.reviews to authenticated;
grant update (rating, title, body) on public.reviews to authenticated;   -- publish/hide/reply: server-side under review.moderate

call private.rls_member_read_staff_write('announcements', 'announcement.manage',
  $$publish_at <= now() and (expires_at is null or expires_at > now())$$);

-- ================================================================ commerce
call private.rls_staff_only('payment_gateway_accounts', 'integration.manage');
call private.rls_staff_only('tax_rates', 'price.manage', 'price.manage');
call private.rls_member_read_staff_write('products', 'product.manage', $$status = 'published' and deleted_at is null$$);
call private.rls_member_read_staff_write('product_items', 'product.manage');
call private.rls_member_read_staff_write('prices', 'price.manage', $$is_active$$);
call private.rls_staff_only('coupons', 'coupon.manage', 'coupon.manage');
call private.rls_owner_read('orders', 'order.view');
create policy order_items_select on public.order_items for select to authenticated
  using (order_id in (select o.id from public.orders o));
create policy installments_select on public.installments for select to authenticated
  using (order_id in (select o.id from public.orders o));
create policy payments_select on public.payments for select to authenticated
  using (order_id in (select o.id from public.orders o));
create policy invoices_select on public.invoices for select to authenticated
  using (order_id in (select o.id from public.orders o) or tenant_id in (select private.perm_tenants('invoice.view')));
grant select on public.order_items, public.installments, public.payments, public.invoices to authenticated;
call private.rls_staff_only('refunds', 'refund.manage');
call private.rls_owner_read('member_subscriptions', 'order.view');
call private.rls_staff_only('coupon_redemptions', 'coupon.manage');
call private.rls_owner_read('affiliates', 'affiliate.manage');
create policy affiliate_conversions_select on public.affiliate_conversions for select to authenticated
  using (affiliate_id in (select a.id from public.affiliates a));
grant select on public.affiliate_conversions to authenticated;
-- gateway_webhook_inbox: service only (no policies, no grants)

-- ================================================================ comms / cms / crm
call private.rls_staff_only('notification_templates', 'notification.manage', 'notification.manage');
create policy notifications_select on public.notifications for select to authenticated
  using (member_id in (select private.my_member_ids()));
create policy notifications_mark_read on public.notifications for update to authenticated
  using (member_id in (select private.my_member_ids())) with check (member_id in (select private.my_member_ids()));
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
call private.rls_owner_write('notification_preferences');
call private.rls_owner_write('push_subscriptions');
call private.rls_staff_only('message_deliveries', 'report.view');

call private.rls_staff_only('site_pages', 'site.manage', 'site.manage');
call private.rls_staff_only('site_page_versions', 'site.manage');
call private.rls_staff_only('site_navigation', 'site.manage', 'site.manage');
call private.rls_staff_only('blog_posts', 'blog.manage', 'blog.manage');
call private.rls_staff_only('showcase_items', 'site.manage', 'site.manage');
call private.rls_staff_only('faqs', 'site.manage', 'site.manage');
call private.rls_staff_only('forms', 'form.manage', 'form.manage');
call private.rls_staff_only('form_submissions', 'lead.view');

call private.rls_staff_only('leads', 'lead.view', 'lead.manage');
-- branch-scoped counsellors
create policy leads_branch_scoped on public.leads for all to authenticated
  using ((tenant_id, branch_id) in (select s.tenant_id, s.scope_id from private.perm_scopes('lead.manage', 'branch') s)
         or owner_member_id in (select private.my_member_ids()))
  with check ((tenant_id, branch_id) in (select s.tenant_id, s.scope_id from private.perm_scopes('lead.manage', 'branch') s)
         or owner_member_id in (select private.my_member_ids()));
create policy lead_activities_select on public.lead_activities for select to authenticated
  using (lead_id in (select l.id from public.leads l));
create policy lead_activities_insert on public.lead_activities for insert to authenticated
  with check (lead_id in (select l.id from public.leads l) and by_member_id in (select private.my_member_ids()));
grant select, insert on public.lead_activities to authenticated;

-- ================================================================ ops
call private.rls_staff_only('audit_logs', 'audit.view');
call private.rls_staff_only('api_keys', 'apikey.manage');
call private.rls_staff_only('webhook_endpoints', 'webhook.manage');
call private.rls_staff_only('webhook_deliveries', 'webhook.manage');
call private.rls_staff_only('integrations', 'integration.manage');
call private.rls_staff_only('import_jobs', 'member.import');
-- outbox_events, tenant_counters, gateway_webhook_inbox: service only

-- ================================================================ views
grant select on public.v_syllabus_item_status, public.v_instructor_syllabus_progress, public.v_enrollment_overview to authenticated;

-- ================================================================ RPCs
grant execute on function public.record_lesson_progress(uuid, int, int, numeric, boolean) to authenticated;
grant execute on function public.start_test_attempt(uuid)                                   to authenticated;
grant execute on function public.get_attempt_paper(uuid)                                    to authenticated;
grant execute on function public.save_attempt_answer(uuid, uuid, jsonb, int, boolean)      to authenticated;
grant execute on function public.submit_test_attempt(uuid)                                  to authenticated;
-- public.bootstrap_tenant: service_role only (default)
revoke execute on function public.bootstrap_tenant(uuid, uuid, text, text, jsonb) from authenticated, anon, public;

-- service_role (server code, workers) keeps full access; it bypasses RLS by design.
grant all on all tables in schema public  to service_role;
grant all on all tables in schema control to service_role;
grant execute on all functions in schema public  to service_role;
grant execute on all functions in schema private to service_role;
grant execute on all functions in schema control to service_role;
