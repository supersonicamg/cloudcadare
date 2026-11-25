-- Slice 5 (plan/16 §5.3-5.5, §11): approve and reject a UPI payment. Run with `node scripts/db-test.mjs packages/db/tests/learner_flows_review.sql`.
-- Everything happens in a transaction that is rolled back.
do $$
declare
  t      uuid := (select id from public.tenants where slug = 'cloudcadre');
  staff  uuid;  sm uuid;                     -- a staff user who may verify (owner) and their member id
  u1 uuid := gen_random_uuid();  m1 uuid;    -- buyer
  u2 uuid := gen_random_uuid();  m2 uuid;    -- another learner
  o1 uuid; o2 uuid; o3 uuid;
  r jsonb; r2 jsonb;
  pr1 uuid; pr2 uuid; pr3 uuid; pr4 uuid;
  n int;
  saved jsonb;
begin
  select m.user_id, m.id into staff, sm from public.member_roles mr
    join public.role_permissions rp on rp.role_id = mr.role_id and rp.permission_key = 'payment.verify'
    join public.tenant_members m on m.id = mr.member_id
   where mr.tenant_id = t and mr.scope_type = 'tenant' and m.user_id is not null limit 1;
  if staff is null then
    select m.user_id, m.id into staff, sm from public.member_roles mr join public.roles ro on ro.id = mr.role_id and ro.key = 'owner'
      join public.tenant_members m on m.id = mr.member_id where mr.tenant_id = t and m.user_id is not null limit 1;
  end if;
  if staff is null then raise exception 'no staff member who can verify payments in the dev academy'; end if;

  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (u1, 'review-buyer@example.com', 'authenticated', 'authenticated', '{}'),
    (u2, 'review-other@example.com', 'authenticated', 'authenticated', '{}');
  insert into public.tenant_members (tenant_id, user_id, display_name, email, email_verified_at) values (t, u1, 'Buyer', 'review-buyer@example.com', now()) returning id into m1;
  insert into public.tenant_members (tenant_id, user_id, display_name, email, email_verified_at) values (t, u2, 'Other', 'review-other@example.com', now()) returning id into m2;
  update public.tenant_members set email_verified_at = coalesce(email_verified_at, now()) where id = sm;  -- a fresh database's staff never confirmed an email
  insert into public.orders (tenant_id, order_no, member_id, status, total_minor, subtotal_minor) values (t, 'CC-SQL-R00001', m1, 'awaiting_payment', 4999900, 4999900) returning id into o1;
  insert into public.orders (tenant_id, order_no, member_id, status, total_minor, subtotal_minor) values (t, 'CC-SQL-R00002', sm, 'awaiting_payment', 4999900, 4999900) returning id into o2;
  insert into public.orders (tenant_id, order_no, member_id, status, total_minor, subtotal_minor) values (t, 'CC-SQL-R00003', m2, 'awaiting_payment', 4999900, 4999900) returning id into o3;

  select commerce into saved from public.tenant_settings where tenant_id = t;
  update public.tenant_settings set commerce = coalesce(commerce, '{}'::jsonb) || '{"upi":{"enabled":true,"vpa":"test@okaxis","payee_name":"Test"}}'::jsonb where tenant_id = t;

  -- three learners press "I have paid" (the buyer, the staff member for their own order, another learner)
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  pr1 := (public.submit_upi_payment(o1) ->> 'proof_id')::uuid;
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  pr2 := (public.submit_upi_payment(o2) ->> 'proof_id')::uuid;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  pr3 := (public.submit_upi_payment(o3) ->> 'proof_id')::uuid;

  -- a learner cannot approve or reject; staff without the two-step check cannot either
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  begin perform public.approve_upi_payment(pr1, true, true); raise exception 'a learner must not approve';
  exception when insufficient_privilege then raise notice 'ok: learners cannot approve'; end;
  begin perform public.reject_upi_payment(pr1, 'not_received', null); raise exception 'a learner must not reject';
  exception when insufficient_privilege then raise notice 'ok: learners cannot reject'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  begin perform public.approve_upi_payment(pr1, true, true); raise exception 'aal1 staff must not approve';
  exception when insufficient_privilege then raise notice 'ok: approving needs the two-step check'; end;

  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated', 'aal', 'aal2')::text, true);

  -- the "I can see the money" tick is required; so is the WhatsApp tick for WhatsApp proofs
  begin perform public.approve_upi_payment(pr1, false, true); raise exception 'approve without money_seen must fail';
  exception when raise_exception then if sqlerrm <> 'money_not_seen' then raise; end if; raise notice 'ok: approve without money_seen fails'; end;
  begin perform public.approve_upi_payment(pr1, true, false); raise exception 'approve of a WhatsApp proof without the WhatsApp tick must fail';
  exception when raise_exception then if sqlerrm <> 'whatsapp_not_seen' then raise; end if; raise notice 'ok: a WhatsApp proof needs the WhatsApp tick'; end;
  if (select state from public.payment_proofs where id = pr1) <> 'pending_review' then raise exception 'a refused approval must change nothing'; end if;

  -- nobody approves their own payment
  begin perform public.approve_upi_payment(pr2, true, true); raise exception 'own order must be refused';
  exception when raise_exception then if sqlerrm <> 'own_order' then raise; end if; raise notice 'ok: own order refused'; end;

  -- approve: order paid, payment captured, receipt event queued, audit row written
  r := public.approve_upi_payment(pr1, true, true);
  if r ->> 'order_status' <> 'paid' or (r ->> 'already')::boolean then raise exception 'approve result: %', r; end if;
  if (select status from public.orders where id = o1) <> 'paid' then raise exception 'order must be paid'; end if;
  if (select status from public.payments where order_id = o1) <> 'captured' then raise exception 'payment must be captured'; end if;
  select count(*) into n from public.payments where order_id = o1;
  if n <> 1 then raise exception 'fulfil_order must not add a second payment, saw %', n; end if;
  if not exists (select 1 from public.outbox_events where aggregate_id = o1 and event_type = 'order.paid') then raise exception 'the receipt event must be queued'; end if;
  if not exists (select 1 from public.audit_logs where entity_id = pr1 and action = 'payment.upi_approved' and actor_user_id = staff) then raise exception 'approve must be audited'; end if;
  if (select reviewed_by from public.payment_proofs where id = pr1) is distinct from sm then raise exception 'the reviewer must be recorded'; end if;
  raise notice 'ok: approve pays the order, captures the payment, queues the receipt, audits';

  -- approving twice is a no-op that says so
  r2 := public.approve_upi_payment(pr1, true, true);
  if not (r2 ->> 'already')::boolean or r2 ->> 'state' <> 'approved' then raise exception 'second approve must be a no-op: %', r2; end if;
  select count(*) into n from public.audit_logs where entity_id = pr1 and action = 'payment.upi_approved';
  if n <> 1 then raise exception 'second approve must not audit again, saw %', n; end if;
  select count(*) into n from public.outbox_events where aggregate_id = o1 and event_type = 'order.paid';
  if n <> 1 then raise exception 'second approve must not queue a second receipt, saw %', n; end if;
  raise notice 'ok: approving twice is a no-op';

  -- reject needs a reason from the list; it leaves the order awaiting payment and queues the learner message
  begin perform public.reject_upi_payment(pr3, 'because', null); raise exception 'an unknown reason must be refused';
  exception when invalid_parameter_value then raise notice 'ok: reject reason must be from the list'; end;
  r := public.reject_upi_payment(pr3, 'amount_mismatch', 'We saw 40,000.');
  if r ->> 'state' <> 'rejected' then raise exception 'reject result: %', r; end if;
  if (select status from public.orders where id = o3) <> 'awaiting_payment' then raise exception 'a rejected proof leaves the order awaiting payment'; end if;
  if (select status from public.payments where id = (select payment_id from public.payment_proofs where id = pr3)) <> 'failed' then raise exception 'rejected payment must be failed'; end if;
  if not exists (select 1 from public.outbox_events where aggregate_id = o3 and event_type = 'payment.needs_action') then raise exception 'needs_action must be queued'; end if;
  r2 := public.reject_upi_payment(pr3, 'not_received', null);
  if not (r2 ->> 'already')::boolean or (select reject_reason from public.payment_proofs where id = pr3) <> 'amount_mismatch' then raise exception 'rejecting twice must change nothing'; end if;
  begin perform public.approve_upi_payment(pr3, true, true); raise notice 'ok: a rejected proof stays rejected';
  exception when others then null; end;
  if (select state from public.payment_proofs where id = pr3) <> 'rejected' then raise exception 'a rejected proof must not become approved'; end if;
  raise notice 'ok: reject keeps the order open, fails the payment, queues the message';

  -- top-up: the learner pays again for the part that is missing. Approve a short first payment, then the balance.
  -- (the buyer o3 sends a new proof; we then lower that proof's amount to simulate a part payment of 40,000)
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  pr4 := (public.submit_upi_payment(o3) ->> 'proof_id')::uuid;
  if (select amount_minor from public.payments where id = (select payment_id from public.payment_proofs where id = pr4)) <> 4999900 then raise exception 'the retry is for the full balance'; end if;
  -- simulate "part of it": split the first payment to 4,000,000 captured by hand-editing the open payment and proof
  update public.payments set amount_minor = 4000000 where id = (select payment_id from public.payment_proofs where id = pr4);
  update public.payment_proofs set amount_minor = 4000000 where id = pr4;
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  r := public.approve_upi_payment(pr4, true, true);
  if r ->> 'order_status' <> 'partially_paid' then raise exception 'a short payment leaves the order partially_paid: %', r; end if;
  if (select amount_paid_minor from public.orders where id = o3) <> 4000000 then raise exception 'amount_paid must show the part'; end if;
  if exists (select 1 from public.outbox_events where aggregate_id = o3 and event_type = 'order.paid') then raise exception 'no receipt before the order is fully paid'; end if;
  -- the next QR is for the balance only, and approving it reaches paid
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  r := public.submit_upi_payment(o3);
  if (select amount_minor from public.payments where id = (r ->> 'payment_id')::uuid) <> 999900 then raise exception 'the top-up must be for the balance of 9,999'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  r := public.approve_upi_payment((r ->> 'proof_id')::uuid, true, true);
  if r ->> 'order_status' <> 'paid' then raise exception 'the top-up must complete the order: %', r; end if;
  if (select status from public.orders where id = o3) <> 'paid' then raise exception 'order must be paid after the top-up'; end if;
  raise notice 'ok: top-up reaches paid only at the full total';

  -- RLS: a learner reads only their own proofs; staff read all; anon none
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  select count(*) into n from public.payment_proofs where order_id in (o2, o3);
  if n <> 0 then raise exception 'a learner must not read other learners'' proofs, saw %', n; end if;
  select count(*) into n from public.payment_proofs where order_id = o1;
  if n <> 1 then raise exception 'the buyer reads their own proof'; end if;
  begin update public.payment_proofs set reject_note = 'x'; raise exception 'learners must not write proofs';
  exception when insufficient_privilege then null; end;
  set local role anon;
  perform set_config('request.jwt.claims', '{}', true);
  begin select count(*) into n from public.payment_proofs; if n <> 0 then raise exception 'anon must read nothing'; end if;
  exception when insufficient_privilege then null; end;
  reset role;
  raise notice 'ok: RLS (own only, anon none)';

  update public.tenant_settings set commerce = saved where tenant_id = t;
end $$;
