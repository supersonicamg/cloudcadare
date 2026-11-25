-- =============================================================================
-- 99_seed_catalog.sql
-- Reference data that must exist on every environment:
-- feature catalog, permission catalog, role templates, verticals, frontend
-- templates, the platform distributor, the first pooled data plane, sample
-- plans & add-ons, reserved slugs, default notification templates.
-- Idempotent (on conflict do nothing / update).
-- =============================================================================

insert into control.platform_settings (key, value) values
  ('base_domain',   '"yourplatform.app"'),     -- tenants get {slug}.yourplatform.app
  ('console_host',  '"console.yourplatform.app"'),
  ('support_email', '"support@yourplatform.app"')
on conflict (key) do nothing;

-- ----------------------------------------------------------------- features
insert into control.features (key, module, name, kind, is_core, default_enabled, default_limit, unit, depends_on, lifecycle, sort_order) values
  -- core (always on, never sold separately)
  ('core.auth',               'core',      'Sign-in & accounts',               'boolean', true,  true,  null, null, '{}', 'ga', 1),
  ('core.members',            'core',      'Member directory',                 'boolean', true,  true,  null, null, '{}', 'ga', 2),
  ('core.roles',              'core',      'Roles & permissions',              'boolean', true,  true,  null, null, '{}', 'ga', 3),
  ('core.branding',           'core',      'Branding & theme',                 'boolean', true,  true,  null, null, '{}', 'ga', 4),
  ('core.media',              'core',      'Media library',                    'boolean', true,  true,  null, null, '{}', 'ga', 5),
  ('core.notifications',      'core',      'In-app notifications',             'boolean', true,  true,  null, null, '{}', 'ga', 6),
  ('core.audit',              'core',      'Audit log',                        'boolean', true,  true,  null, null, '{}', 'ga', 7),
  -- website
  ('site.cms',                'site',      'Website builder',                  'boolean', false, true,  null, null, '{}', 'ga', 10),
  ('site.blog',               'site',      'Blog',                             'boolean', false, false, null, null, '{site.cms}', 'ga', 11),
  ('site.custom_domain',      'site',      'Custom domain',                    'boolean', false, false, null, null, '{}', 'ga', 12),
  ('site.remove_branding',    'site',      'Remove "Powered by"',              'boolean', false, false, null, null, '{}', 'ga', 13),
  ('site.multi_language',     'site',      'Multi-language content',           'boolean', false, false, null, null, '{}', 'beta', 14),
  -- catalog
  ('catalog.courses',         'catalog',   'Courses',                          'boolean', false, true,  null, null, '{}', 'ga', 20),
  ('catalog.bundles',         'catalog',   'Bundles & packages',               'boolean', false, false, null, null, '{catalog.courses}', 'ga', 21),
  ('catalog.material_packs',  'catalog',   'Study-material packs',             'boolean', false, false, null, null, '{}', 'ga', 22),
  ('catalog.test_series',     'catalog',   'Test series',                      'boolean', false, false, null, null, '{assess.quizzes}', 'ga', 23),
  ('catalog.reviews',         'catalog',   'Ratings & reviews',                'boolean', false, false, null, null, '{catalog.courses}', 'ga', 24),
  -- content
  ('content.video',           'content',   'Video lessons (streaming)',        'boolean', false, true,  null, null, '{}', 'ga', 30),
  ('content.video_drm',       'content',   'DRM-protected video',              'boolean', false, false, null, null, '{content.video}', 'ga', 31),
  ('content.documents',       'content',   'PDFs, docs & images',              'boolean', false, true,  null, null, '{}', 'ga', 32),
  ('content.watermark',       'content',   'Dynamic watermarking',             'boolean', false, false, null, null, '{}', 'ga', 33),
  ('content.downloads',       'content',   'Downloadable resources',           'boolean', false, true,  null, null, '{}', 'ga', 34),
  ('content.scorm',           'content',   'SCORM packages',                   'boolean', false, false, null, null, '{}', 'beta', 35),
  ('content.labs',            'content',   'Hands-on labs (external sandboxes)','boolean', false, false, null, null, '{}', 'beta', 36),
  -- learning
  ('learning.progress',       'learning',  'Progress tracking',                'boolean', false, false, null, null, '{}', 'ga', 40),
  ('learning.drip',           'learning',  'Drip / scheduled unlock',          'boolean', false, false, null, null, '{learning.progress}', 'ga', 41),
  ('learning.certificates',   'learning',  'Certificates',                     'boolean', false, false, null, null, '{learning.progress}', 'ga', 42),
  ('learning.notes',          'learning',  'Notes & bookmarks',                'boolean', false, false, null, null, '{}', 'ga', 43),
  -- cohorts
  ('cohort.batches',          'cohort',    'Batches / cohorts',                'boolean', false, false, null, null, '{}', 'ga', 50),
  ('cohort.syllabus_tracking','cohort',    'Faculty syllabus tracking',        'boolean', false, false, null, null, '{cohort.batches}', 'ga', 51),
  ('cohort.content_release',  'cohort',    'Per-batch content release',        'boolean', false, false, null, null, '{cohort.batches}', 'ga', 52),
  -- live
  ('live.classes',            'live',      'Live classes',                     'boolean', false, false, null, null, '{}', 'ga', 60),
  ('live.attendance',         'live',      'Attendance',                       'boolean', false, false, null, null, '{live.classes}', 'ga', 61),
  ('live.recordings',         'live',      'Class recordings',                 'boolean', false, false, null, null, '{live.classes,content.video}', 'ga', 62),
  -- assessments
  ('assess.quizzes',          'assess',    'Quizzes & tests',                  'boolean', false, false, null, null, '{}', 'ga', 70),
  ('assess.question_bank',    'assess',    'Question bank',                    'boolean', false, false, null, null, '{assess.quizzes}', 'ga', 71),
  ('assess.advanced_tests',   'assess',    'Sections, negative marking, ranks','boolean', false, false, null, null, '{assess.quizzes}', 'ga', 72),
  ('assess.proctoring',       'assess',    'Basic proctoring',                 'boolean', false, false, null, null, '{assess.quizzes}', 'beta', 73),
  ('assess.assignments',      'assess',    'Assignments',                      'boolean', false, false, null, null, '{}', 'ga', 74),
  ('assess.analytics',        'assess',    'Test & question analytics',        'boolean', false, false, null, null, '{assess.quizzes}', 'ga', 75),
  -- engagement
  ('engage.gamification',     'engage',    'XP & levels',                      'boolean', false, false, null, null, '{learning.progress}', 'ga', 80),
  ('engage.badges',           'engage',    'Badges',                           'boolean', false, false, null, null, '{engage.gamification}', 'ga', 81),
  ('engage.leaderboards',     'engage',    'Leaderboards',                     'boolean', false, false, null, null, '{engage.gamification}', 'ga', 82),
  ('engage.streaks',          'engage',    'Learning streaks',                 'boolean', false, false, null, null, '{learning.progress}', 'ga', 83),
  ('engage.discussions',      'engage',    'Discussion forums',                'boolean', false, false, null, null, '{}', 'ga', 84),
  ('engage.doubts',           'engage',    'Doubt solving',                    'boolean', false, false, null, null, '{}', 'ga', 85),
  ('engage.announcements',    'engage',    'Announcements',                    'boolean', false, true,  null, null, '{}', 'ga', 86),
  -- communication
  ('comms.email',             'comms',     'Email notifications',              'boolean', false, true,  null, null, '{}', 'ga', 90),
  ('comms.sms',               'comms',     'SMS (DLT)',                        'boolean', false, false, null, null, '{}', 'ga', 91),
  ('comms.whatsapp',          'comms',     'WhatsApp notifications',           'boolean', false, false, null, null, '{}', 'ga', 92),
  ('comms.push',              'comms',     'Push notifications',               'boolean', false, false, null, null, '{}', 'ga', 93),
  -- commerce
  ('commerce.checkout',       'commerce',  'Online payments',                  'boolean', false, false, null, null, '{}', 'ga', 100),
  ('commerce.coupons',        'commerce',  'Coupons',                          'boolean', false, false, null, null, '{commerce.checkout}', 'ga', 101),
  ('commerce.installments',   'commerce',  'Installments / EMI',               'boolean', false, false, null, null, '{commerce.checkout}', 'ga', 102),
  ('commerce.subscriptions',  'commerce',  'Learner subscriptions',            'boolean', false, false, null, null, '{commerce.checkout}', 'ga', 103),
  ('commerce.offline_payments','commerce', 'Offline fee collection',           'boolean', false, false, null, null, '{}', 'ga', 104),
  ('commerce.gst_invoicing',  'commerce',  'GST invoices',                     'boolean', false, false, null, null, '{}', 'ga', 105),
  ('commerce.affiliates',     'commerce',  'Affiliates & referrals',           'boolean', false, false, null, null, '{commerce.checkout}', 'ga', 106),
  -- CRM
  ('crm.leads',               'crm',       'Leads & enquiries',                'boolean', false, false, null, null, '{}', 'ga', 110),
  ('crm.forms',               'crm',       'Custom forms',                     'boolean', false, true,  null, null, '{}', 'ga', 111),
  -- organisation
  ('org.branches',            'org',       'Multiple branches / centres',      'boolean', false, false, null, null, '{}', 'ga', 120),
  ('org.parent_portal',       'org',       'Parent / guardian portal',         'boolean', false, false, null, null, '{}', 'ga', 121),
  ('org.custom_roles',        'org',       'Custom roles',                     'boolean', false, false, null, null, '{}', 'ga', 122),
  ('org.custom_fields',       'org',       'Custom fields',                    'boolean', false, false, null, null, '{}', 'ga', 123),
  -- analytics
  ('analytics.basic',         'analytics', 'Dashboards',                       'boolean', false, true,  null, null, '{}', 'ga', 130),
  ('analytics.advanced',      'analytics', 'Cohort & funnel analytics',        'boolean', false, false, null, null, '{analytics.basic}', 'ga', 131),
  ('analytics.exports',       'analytics', 'CSV / Excel exports',              'boolean', false, false, null, null, '{}', 'ga', 132),
  -- integrations & security
  ('integrations.api',        'integrations','Public API keys',                'boolean', false, false, null, null, '{}', 'ga', 140),
  ('integrations.webhooks',   'integrations','Outbound webhooks',              'boolean', false, false, null, null, '{}', 'ga', 141),
  ('integrations.sso',        'integrations','SSO (Google Workspace / SAML)',  'boolean', false, false, null, null, '{}', 'ga', 142),
  ('security.device_limits',  'security',  'Device / session limits',          'boolean', false, false, null, null, '{}', 'ga', 150),
  -- AI
  ('ai.doubt_assistant',      'ai',        'AI doubt assistant',               'boolean', false, false, null, null, '{}', 'beta', 160),
  ('ai.question_generator',   'ai',        'AI question generator',            'boolean', false, false, null, null, '{assess.question_bank}', 'beta', 161),
  -- apps
  ('app.pwa',                 'app',       'Installable web app (PWA)',        'boolean', false, true,  null, null, '{}', 'ga', 170),
  ('app.mobile',              'app',       'Branded mobile app',               'boolean', false, false, null, null, '{}', 'alpha', 171),
  -- limits (NULL limit = unlimited)
  ('limit.members',           'limits',    'Active members',                   'limit',   false, true,  100,  'members',  '{}', 'ga', 200),
  ('limit.staff',             'limits',    'Staff seats',                      'limit',   false, true,  3,    'seats',    '{}', 'ga', 201),
  ('limit.courses',           'limits',    'Courses',                          'limit',   false, true,  5,    'courses',  '{}', 'ga', 202),
  ('limit.branches',          'limits',    'Branches',                         'limit',   false, true,  1,    'branches', '{}', 'ga', 203),
  ('limit.storage_gb',        'limits',    'File storage',                     'limit',   false, true,  5,    'gb',       '{}', 'ga', 204),
  ('limit.video_hours',       'limits',    'Video hosting',                    'limit',   false, true,  10,   'hours',    '{}', 'ga', 205),
  ('limit.emails_monthly',    'limits',    'Emails per month',                 'limit',   false, true,  2000, 'messages', '{}', 'ga', 206),
  ('limit.sms_monthly',       'limits',    'SMS per month',                    'limit',   false, true,  0,    'messages', '{}', 'ga', 207),
  ('limit.whatsapp_monthly',  'limits',    'WhatsApp messages per month',      'limit',   false, true,  0,    'messages', '{}', 'ga', 208),
  ('limit.ai_credits_monthly','limits',    'AI credits per month',             'limit',   false, true,  0,    'credits',  '{}', 'ga', 209)
on conflict (key) do update set name = excluded.name, depends_on = excluded.depends_on, lifecycle = excluded.lifecycle;

-- -------------------------------------------------------------- permissions
insert into public.permission_catalog (key, feature_key, group_name, description, is_sensitive) values
  ('tenant.settings.manage',   'core.auth',              'Settings',     'Edit academy settings', true),
  ('tenant.branding.manage',   'core.branding',          'Settings',     'Edit branding & theme', false),
  ('tenant.modules.manage',    'core.auth',              'Settings',     'Turn modules on/off', true),
  ('tenant.billing.view',      'core.auth',              'Settings',     'View platform subscription', false),
  ('member.view',              'core.members',           'People',       'View members', false),
  ('member.invite',            'core.members',           'People',       'Invite members', false),
  ('member.manage',            'core.members',           'People',       'Edit / suspend members', true),
  ('member.import',            'core.members',           'People',       'Bulk import members', true),
  ('member.export',            'analytics.exports',      'People',       'Export member data', true),
  ('role.manage',              'core.roles',             'People',       'Manage roles & grants', true),
  ('guardian.manage',          'org.parent_portal',      'People',       'Link guardians', false),
  ('branch.manage',            'org.branches',           'People',       'Manage branches', false),
  ('course.view_all',          'catalog.courses',        'Content',      'View drafts & all courses', false),
  ('course.manage',            'catalog.courses',        'Content',      'Create & edit courses', false),
  ('course.publish',           'catalog.courses',        'Content',      'Publish courses', false),
  ('content.upload',           'core.media',             'Content',      'Upload media', false),
  ('batch.manage',             'cohort.batches',         'Batches',      'Manage batches', false),
  ('live.manage',              'live.classes',           'Live',         'Schedule any live class', false),
  ('live.host',                'live.classes',           'Live',         'Host live classes', false),
  ('attendance.view',          'live.attendance',        'Live',         'View attendance', false),
  ('attendance.mark',          'live.attendance',        'Live',         'Mark attendance', false),
  ('syllabus.manage',          'cohort.syllabus_tracking','Batches',     'Plan syllabus', false),
  ('syllabus.update_coverage', 'cohort.syllabus_tracking','Batches',     'Log syllabus coverage', false),
  ('enrollment.view',          'catalog.courses',        'Learners',     'View enrollments', false),
  ('enrollment.manage',        'catalog.courses',        'Learners',     'Grant / revoke access', true),
  ('progress.view',            'learning.progress',      'Learners',     'View learner progress', false),
  ('question.view',            'assess.quizzes',         'Assessments',  'View question bank', false),
  ('question.manage',          'assess.quizzes',         'Assessments',  'Edit questions & answer keys', false),
  ('test.manage',              'assess.quizzes',         'Assessments',  'Create & edit tests', false),
  ('test.grade',               'assess.quizzes',         'Assessments',  'Grade subjective answers', false),
  ('result.view',              'assess.quizzes',         'Assessments',  'View results', false),
  ('result.publish',           'assess.quizzes',         'Assessments',  'Publish results', false),
  ('assignment.manage',        'assess.assignments',     'Assessments',  'Manage assignments', false),
  ('assignment.grade',         'assess.assignments',     'Assessments',  'Grade assignments', false),
  ('gamification.manage',      'engage.gamification',    'Engagement',   'Manage XP, levels, badges, leaderboards', false),
  ('certificate.manage',       'learning.certificates',  'Engagement',   'Manage & issue certificates', false),
  ('discussion.moderate',      'engage.discussions',     'Engagement',   'Moderate discussions', false),
  ('doubt.answer',             'engage.doubts',          'Engagement',   'Answer doubts', false),
  ('review.moderate',          'catalog.reviews',        'Engagement',   'Moderate reviews', false),
  ('announcement.manage',      'engage.announcements',   'Engagement',   'Post announcements', false),
  ('notification.manage',      'core.notifications',     'Engagement',   'Edit notification templates', false),
  ('product.manage',           'commerce.checkout',      'Sales',        'Manage products & bundles', false),
  ('price.manage',             'commerce.checkout',      'Sales',        'Manage prices & taxes', true),
  ('coupon.manage',            'commerce.coupons',       'Sales',        'Manage coupons', false),
  ('order.view',               'commerce.checkout',      'Sales',        'View orders & payments', false),
  ('order.manage',             'commerce.checkout',      'Sales',        'Edit orders', true),
  ('payment.record_offline',   'commerce.offline_payments','Sales',      'Record offline payments', true),
  ('refund.manage',            'commerce.checkout',      'Sales',        'Issue refunds', true),
  ('payment.verify',          'commerce.checkout',      'Sales',        'Verify UPI payments', true),
  ('invoice.view',             'commerce.gst_invoicing', 'Sales',        'View invoices', false),
  ('affiliate.manage',         'commerce.affiliates',    'Sales',        'Manage affiliates', false),
  ('lead.view',                'crm.leads',              'CRM',          'View leads', false),
  ('lead.manage',              'crm.leads',              'CRM',          'Manage leads', false),
  ('form.manage',              'crm.forms',              'CRM',          'Manage forms', false),
  ('site.manage',              'site.cms',               'Website',      'Edit website pages', false),
  ('blog.manage',              'site.blog',              'Website',      'Edit blog', false),
  ('report.view',              'analytics.basic',        'Reports',      'View reports', false),
  ('report.export',            'analytics.exports',      'Reports',      'Export reports', true),
  ('integration.manage',       'integrations.api',       'Developer',    'Connect integrations & gateways', true),
  ('apikey.manage',            'integrations.api',       'Developer',    'Manage API keys', true),
  ('webhook.manage',           'integrations.webhooks',  'Developer',    'Manage webhooks', true),
  ('audit.view',               'core.audit',             'Developer',    'View audit log', false)
on conflict (key) do update set description = excluded.description, feature_key = excluded.feature_key, is_sensitive = excluded.is_sensitive;

-- ---------------------------------------------------------- role templates
insert into private.role_templates (key, name, kind, description, permissions, sort_order) values
  ('owner',      'Owner',               'staff',    'Full control, including billing & roles', '{*}', 1),
  ('admin',      'Administrator',       'staff',    'Runs the academy day to day', '{*}', 2),
  ('manager',    'Academic coordinator','staff',    'Courses, batches, schedules, results',
     '{member.view,member.invite,course.view_all,course.manage,course.publish,content.upload,batch.manage,live.manage,live.host,attendance.view,attendance.mark,syllabus.manage,syllabus.update_coverage,enrollment.view,enrollment.manage,progress.view,question.view,question.manage,test.manage,test.grade,result.view,result.publish,assignment.manage,assignment.grade,gamification.manage,certificate.manage,discussion.moderate,doubt.answer,review.moderate,announcement.manage,report.view}', 3),
  ('instructor', 'Instructor / Faculty','staff',    'Teaches, tracks syllabus, grades',
     '{course.view_all,content.upload,live.host,attendance.view,attendance.mark,syllabus.update_coverage,progress.view,question.view,question.manage,test.manage,test.grade,result.view,assignment.manage,assignment.grade,doubt.answer,discussion.moderate,announcement.manage}', 4),
  ('assistant',  'Teaching assistant',  'staff',    'Supports faculty: doubts, grading, attendance',
     '{course.view_all,attendance.mark,attendance.view,progress.view,test.grade,result.view,assignment.grade,doubt.answer}', 5),
  ('content_creator','Content creator', 'staff',    'Builds courses & question banks',
     '{course.view_all,course.manage,content.upload,question.view,question.manage,test.manage}', 6),
  ('counsellor', 'Counsellor / Sales',  'staff',    'Leads, enquiries, admissions',
     '{member.view,member.invite,lead.view,lead.manage,order.view,enrollment.view}', 7),
  ('accountant', 'Accountant',          'staff',    'Fees, payments, invoices',
     '{member.view,order.view,order.manage,payment.record_offline,payment.verify,refund.manage,invoice.view,report.view,report.export}', 8),
  ('student',    'Student',             'learner',  'Learner', '{}', 20),
  ('guardian',   'Parent / Guardian',   'guardian', 'Views linked learners', '{}', 21)
on conflict (key) do update set permissions = excluded.permissions, name = excluded.name;

-- --------------------------------------------------------------- verticals
insert into control.vertical_templates (key, name, description, terminology, disabled_modules, default_settings, seed) values
  ('generic', 'Generic academy', 'Neutral defaults',
    '{"course":"Course","batch":"Batch","instructor":"Instructor","student":"Student","lesson":"Lesson","section":"Module","test":"Test"}',
    '{}', '{}',
    '{"levels":[{"level_no":1,"name":"Beginner","min_xp":0},{"level_no":2,"name":"Learner","min_xp":500},{"level_no":3,"name":"Achiever","min_xp":2000},{"level_no":4,"name":"Expert","min_xp":5000}],
      "badges":[{"key":"first_lesson","name":"First step","tier":"bronze","criteria":{"event":"lesson.completed","count":1},"xp_reward":10},
                {"key":"week_streak","name":"7-day streak","tier":"silver","criteria":{"metric":"current_streak","gte":7},"xp_reward":50},
                {"key":"course_complete","name":"Finisher","tier":"gold","criteria":{"event":"course.completed","count":1},"xp_reward":100}]}'),
  ('cloud_training', 'Cloud & IT training', 'AWS / Azure / GCP / FinOps / GreenOps / DevOps academies',
    '{"course":"Track","batch":"Cohort","instructor":"Mentor","student":"Learner","lesson":"Lesson","section":"Phase","test":"Assessment"}',
    '{commerce.offline_payments,org.parent_portal}',
    '{"learning":{"sequential":true,"completion_threshold_pct":90},"assessment":{"default_negative_marking":0}}',
    '{"levels":[{"level_no":1,"name":"Cloud Explorer","min_xp":0},{"level_no":2,"name":"Practitioner","min_xp":800},{"level_no":3,"name":"Associate","min_xp":2500},{"level_no":4,"name":"Professional","min_xp":6000},{"level_no":5,"name":"Architect","min_xp":12000}],
      "badges":[{"key":"first_lab","name":"Hands on keyboard","tier":"bronze","criteria":{"event":"lesson.completed","where":{"lesson_type":"lab"},"count":1},"xp_reward":20},
                {"key":"mock_90","name":"Exam ready","tier":"gold","criteria":{"event":"test.graded","where":{"percentage_gte":90},"count":1},"xp_reward":150},
                {"key":"month_streak","name":"30-day streak","tier":"platinum","criteria":{"metric":"current_streak","gte":30},"xp_reward":300}]}'),
  ('neet_jee', 'NEET / JEE coaching', 'Medical & engineering entrance coaching',
    '{"course":"Course","batch":"Batch","instructor":"Faculty","student":"Student","lesson":"Lecture","section":"Chapter","test":"Test"}',
    '{engage.discussions}',
    '{"assessment":{"default_negative_marking":1,"default_marks":4},"security":{"require_mfa_for_sensitive":false}}',
    '{"levels":[{"level_no":1,"name":"Aspirant","min_xp":0},{"level_no":2,"name":"Contender","min_xp":1000},{"level_no":3,"name":"Ranker","min_xp":4000},{"level_no":4,"name":"Topper","min_xp":10000}],
      "badges":[{"key":"full_mock","name":"Full mock warrior","tier":"silver","criteria":{"event":"test.graded","where":{"test_kind":"mock"},"count":5},"xp_reward":100}]}'),
  ('upsc', 'UPSC / State PSC', 'Civil services preparation',
    '{"course":"Course","batch":"Batch","instructor":"Faculty","student":"Aspirant","lesson":"Lecture","section":"Module","test":"Test"}',
    '{}',
    '{"assessment":{"default_negative_marking":0.33,"default_marks":2}}',
    '{"levels":[{"level_no":1,"name":"Aspirant","min_xp":0},{"level_no":2,"name":"Prelims ready","min_xp":2000},{"level_no":3,"name":"Mains ready","min_xp":6000}]}'),
  ('k12_tuition', 'School & tuition (K-12)', 'Class 6–12 tuition and coaching',
    '{"course":"Subject","batch":"Class","instructor":"Teacher","student":"Student","lesson":"Chapter","section":"Unit","test":"Test"}',
    '{commerce.affiliates}',
    '{"security":{"require_mfa_for_sensitive":false}}',
    '{"levels":[{"level_no":1,"name":"Starter","min_xp":0},{"level_no":2,"name":"Star","min_xp":500},{"level_no":3,"name":"Super star","min_xp":2000}]}'),
  ('skill_dev', 'Skill development', 'Design, marketing, languages, vocational',
    '{"course":"Course","batch":"Cohort","instructor":"Coach","student":"Learner","lesson":"Lesson","section":"Module","test":"Quiz"}',
    '{}', '{}', '{}')
on conflict (key) do nothing;

-- ------------------------------------------------------- frontend templates
insert into control.frontend_templates (key, name, kind, package_name, deployment_url) values
  ('default',           'Default',            'theme',      '@themes/default', null),
  ('aurora',            'Aurora (bold)',      'theme',      '@themes/aurora',  null),
  ('minimal',           'Minimal',            'theme',      '@themes/minimal', null),
  ('custom:cloudcadre', 'CloudCadre (custom)','custom_app', '@apps/web-cloudcadre', 'https://web-cloudcadre.internal.yourplatform.app')
on conflict (key) do nothing;

insert into control.reserved_slugs (slug)
select unnest(array['www','app','api','admin','console','auth','login','signup','static','cdn','assets','media','mail',
                    'help','support','status','docs','blog','dashboard','billing','platform','root','test','staging','dev'])
on conflict do nothing;

-- ------------------------------------------------- platform distributor & plane
insert into control.distributors (kind, name, slug, can_create_plans, can_create_sub_distributors)
values ('platform', 'Platform', 'platform', true, true)
on conflict (slug) do nothing;

insert into control.data_planes (name, mode, region, status)
values ('pooled-ap-south-1-01', 'pooled', 'ap-south-1', 'active')
on conflict (name) do nothing;

-- ------------------------------------------------------------------- plans
with platform as (select id from control.distributors where kind = 'platform')
insert into control.plans (distributor_id, code, name, description, tier, billing_interval, price_minor, trial_days, is_public)
select platform.id, p.code, p.name, p.description, p.tier, 'month', p.price, p.trial, true
from platform, (values
  ('starter',    'Starter – Study material', 'Sell PDFs, videos & material packs with a branded site', 1,  149900, 14),
  ('growth',     'Growth – LMS',             'Courses, progress, quizzes, gamification, live classes', 2,  499900, 14),
  ('pro',        'Pro – Academy',            'Batches, faculty tracking, test series, CRM, fees',      3, 1499900, 14),
  ('enterprise', 'Enterprise',               'Everything, unlimited, dedicated option',                 4,       0,  0)
) as p(code, name, description, tier, price, trial)
on conflict (distributor_id, code) do nothing;

-- Feature sets (cumulative)
create temporary table _plan_sets (code text, feature_key text, limit_value bigint);
insert into _plan_sets (code, feature_key)
select 'starter', unnest(array['site.cms','catalog.courses','catalog.material_packs','content.video','content.documents',
  'content.downloads','commerce.checkout','commerce.coupons','comms.email','analytics.basic','crm.forms','engage.announcements','app.pwa']);
insert into _plan_sets (code, feature_key)
select 'growth', feature_key from _plan_sets where code = 'starter'
union select 'growth', unnest(array['catalog.bundles','catalog.reviews','learning.progress','learning.drip','learning.certificates',
  'learning.notes','assess.quizzes','assess.assignments','engage.gamification','engage.badges','engage.leaderboards','engage.streaks',
  'engage.discussions','site.blog','site.custom_domain','commerce.installments','comms.push','live.classes','live.attendance',
  'live.recordings','crm.leads']);
insert into _plan_sets (code, feature_key)
select 'pro', feature_key from _plan_sets where code = 'growth'
union select 'pro', unnest(array['cohort.batches','cohort.syllabus_tracking','cohort.content_release','catalog.test_series',
  'assess.question_bank','assess.advanced_tests','assess.proctoring','assess.analytics','engage.doubts','commerce.subscriptions',
  'commerce.offline_payments','commerce.gst_invoicing','commerce.affiliates','org.branches','org.parent_portal','org.custom_roles',
  'org.custom_fields','analytics.advanced','analytics.exports','comms.sms','comms.whatsapp','content.watermark',
  'security.device_limits','site.remove_branding','integrations.webhooks']);
insert into _plan_sets (code, feature_key)
select 'enterprise', key from control.features where kind = 'boolean' and not is_core;

-- Limits per plan (NULL = unlimited)
insert into _plan_sets (code, feature_key, limit_value) values
  ('starter','limit.members',500),   ('starter','limit.staff',2),   ('starter','limit.courses',20),  ('starter','limit.branches',1),
  ('starter','limit.storage_gb',20), ('starter','limit.video_hours',20), ('starter','limit.emails_monthly',5000),
  ('starter','limit.sms_monthly',0), ('starter','limit.whatsapp_monthly',0), ('starter','limit.ai_credits_monthly',0),
  ('growth','limit.members',2000),   ('growth','limit.staff',10),   ('growth','limit.courses',100),  ('growth','limit.branches',1),
  ('growth','limit.storage_gb',100), ('growth','limit.video_hours',200), ('growth','limit.emails_monthly',25000),
  ('growth','limit.sms_monthly',0),  ('growth','limit.whatsapp_monthly',0), ('growth','limit.ai_credits_monthly',0),
  ('pro','limit.members',10000),     ('pro','limit.staff',50),      ('pro','limit.courses',null),    ('pro','limit.branches',10),
  ('pro','limit.storage_gb',500),    ('pro','limit.video_hours',1000), ('pro','limit.emails_monthly',100000),
  ('pro','limit.sms_monthly',5000),  ('pro','limit.whatsapp_monthly',5000), ('pro','limit.ai_credits_monthly',1000),
  ('enterprise','limit.members',null), ('enterprise','limit.staff',null), ('enterprise','limit.courses',null),
  ('enterprise','limit.branches',null), ('enterprise','limit.storage_gb',null), ('enterprise','limit.video_hours',null),
  ('enterprise','limit.emails_monthly',null), ('enterprise','limit.sms_monthly',null),
  ('enterprise','limit.whatsapp_monthly',null), ('enterprise','limit.ai_credits_monthly',null);

insert into control.plan_features (plan_id, feature_key, enabled, limit_value)
select p.id, s.feature_key, true, s.limit_value
from _plan_sets s
join control.plans p on p.code = s.code and p.distributor_id = (select id from control.distributors where kind = 'platform')
on conflict (plan_id, feature_key) do update set enabled = excluded.enabled, limit_value = excluded.limit_value;
drop table _plan_sets;

-- ------------------------------------------------------------------ add-ons
with platform as (select id from control.distributors where kind = 'platform')
insert into control.addons (distributor_id, code, name, price_minor, billing_interval)
select platform.id, a.code, a.name, a.price, 'month'
from platform, (values
  ('members_1000', '+1,000 members',        99900),
  ('drm_video',    'DRM video protection', 199900),
  ('whatsapp_5k',  'WhatsApp 5,000 / month',149900),
  ('ai_assistant', 'AI doubt assistant',   199900)
) as a(code, name, price)
on conflict (distributor_id, code) do nothing;

insert into control.addon_features (addon_id, feature_key, enabled, limit_value, limit_mode)
select a.id, x.feature_key, true, x.limit_value, x.limit_mode
from control.addons a
join (values
  ('members_1000', 'limit.members',           1000, 'add'),
  ('drm_video',    'content.video_drm',       null, 'add'),
  ('whatsapp_5k',  'comms.whatsapp',          null, 'add'),
  ('whatsapp_5k',  'limit.whatsapp_monthly',  5000, 'add'),
  ('ai_assistant', 'ai.doubt_assistant',      null, 'add'),
  ('ai_assistant', 'limit.ai_credits_monthly',2000, 'add')
) as x(code, feature_key, limit_value, limit_mode) on x.code = a.code
on conflict do nothing;

-- --------------------------------------------- default notification templates
insert into public.notification_templates (tenant_id, event_key, channel, subject, body) values
  (null, 'auth.welcome',          'email',  'Welcome to {{tenant.name}}', 'Hi {{member.name}}, your account is ready.'),
  (null, 'enrollment.created',    'email',  'You are enrolled in {{course.title}}', 'Start learning: {{links.course}}'),
  (null, 'enrollment.created',    'in_app', null, 'You now have access to {{course.title}}'),
  (null, 'live.reminder',         'in_app', null, '{{session.title}} starts at {{session.starts_at_local}}'),
  (null, 'live.reminder',         'email',  'Starting soon: {{session.title}}', 'Join here: {{links.session}}'),
  (null, 'test.result_published', 'in_app', null, 'Results for {{test.title}} are out'),
  (null, 'installment.due',       'email',  'Fee installment due on {{installment.due_date}}', 'Amount: {{installment.amount}}. Pay: {{links.pay}}'),
  (null, 'badge.awarded',         'in_app', null, 'You earned the {{badge.name}} badge!'),
  (null, 'doubt.answered',        'in_app', null, 'Your doubt "{{thread.title}}" has an answer')
on conflict do nothing;
