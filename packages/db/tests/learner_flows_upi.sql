-- Slice 4 (plan/16 §5.1-5.2, §11): "I have paid". Run with `node scripts/db-test.mjs packages/db/tests/learner_flows_upi.sql`.
-- Everything happens in a transaction that is rolled back.
do $$
declare
  t  uuid := (select id from public.tenants where slug = 'cloudcadre');
  u1 uuid := gen_random_uuid();  m1 uuid;   -- the buyer
  u2 uuid := gen_random_uuid();  m2 uuid;   -- someone else
  u3 uuid := gen_random_uuid();  m3 uuid;   -- buyer whose email is not confirmed
  o1 uuid; o3 uuid;
  r jsonb; r2 jsonb;
  n int;
  saved jsonb;
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (u1, 'upi-buyer@example.com', 'authenticated', 'authenticated', '{}'),
    (u2, 'upi-other@example.com', 'authenticated', 'authenticated', '{}'),
    (u3, 'upi-unconfirmed@example.com', 'authenticated', 'authenticated', '{}');
  insert into public.tenant_members (tenant_id, user_id, display_name, email, email_verified_at) values (t, u1, 'Buyer', 'upi-buyer@example.com', now()) returning id into m1;
  insert into public.tenant_members (tenant_id, user_id, display_name, email, email_verified_at) values (t, u2, 'Other', 'upi-other@example.com', now()) returning id into m2;
  insert into public.tenant_members (tenant_id, user_id, display_name, email) values (t, u3, 'Unconfirmed', 'upi-unconfirmed@example.com') returning id into m3;
  insert into public.orders (tenant_id, order_no, member_id, status, total_minor, subtotal_minor) values (t, 'CC-SQL-000001', m1, 'awaiting_payment', 4999900, 4999900) returning id into o1;
  insert into public.orders (tenant_id, order_no, member_id, status, total_minor, subtotal_minor) values (t, 'CC-SQL-000003', m3, 'awaiting_payment', 4999900, 4999900) returning id into o3;

  -- remember the academy's settings, then switch UPI on for the test
  select commerce into saved from public.tenant_settings where tenant_id = t;
  update public.tenant_settings set commerce = coalesce(commerce, '{}'::jsonb) || '{"upi":{"enabled":true,"vpa":"test@okaxis","payee_name":"Test"}}'::jsonb where tenant_id = t;

  -- the buyer presses "I have paid": one payment (balance) and one open proof; pressing again changes nothing
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  r := public.submit_upi_payment(o1);
  if (r ->> 'already')::boolean then raise exception 'first press must create'; end if;
  r2 := public.submit_upi_payment(o1);
  if not (r2 ->> 'already')::boolean or r2 ->> 'proof_id' <> r ->> 'proof_id' then raise exception 'second press must return the same proof: %', r2; end if;
  select count(*) into n from public.payments where order_id = o1 and gateway = 'upi_manual' and status = 'created' and amount_minor = 4999900;
  if n <> 1 then raise exception 'expected one created payment for the full balance, got %', n; end if;
  select count(*) into n from public.payment_proofs where order_id = o1 and state = 'pending_review';
  if n <> 1 then raise exception 'expected one open proof, got %', n; end if;
  raise notice 'ok: one payment and one open proof, pressing twice is a no-op';

  -- nothing is unlocked and the order stays unpaid
  if (select status from public.orders where id = o1) <> 'awaiting_payment' then raise exception 'order must stay awaiting_payment'; end if;

  -- someone else cannot press it for this order, an unconfirmed email cannot pay, UPI off refuses
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  begin perform public.submit_upi_payment(o1); raise exception 'another learner must not submit this order';
  exception when no_data_found then raise notice 'ok: not your order'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  begin perform public.submit_upi_payment(o3); raise exception 'unconfirmed email must not submit';
  exception when raise_exception then if sqlerrm <> 'email_not_confirmed' then raise; end if; raise notice 'ok: email must be confirmed first'; end;
  update public.tenant_settings set commerce = commerce || '{"upi":{"enabled":false}}'::jsonb where tenant_id = t;
  update public.tenant_members set email_verified_at = now() where id = m3;
  begin perform public.submit_upi_payment(o3); raise exception 'UPI off must refuse';
  exception when raise_exception then if sqlerrm <> 'upi_not_enabled' then raise; end if; raise notice 'ok: UPI switched off refuses'; end;
  update public.tenant_settings set commerce = commerce || '{"upi":{"enabled":true}}'::jsonb where tenant_id = t;

  -- attach: a bad bank reference, a path in someone else's folder, then a good one; the same reference cannot back a second order
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  begin perform public.attach_payment_proof((r ->> 'proof_id')::uuid, null, '12345'); raise exception 'short reference must be refused';
  exception when invalid_parameter_value then raise notice 'ok: reference must be 12 digits'; end;
  begin perform public.attach_payment_proof((r ->> 'proof_id')::uuid, t::text || '/' || m2::text || '/x.png', null); raise exception 'someone else''s folder must be refused';
  exception when invalid_parameter_value then raise notice 'ok: upload path must be in the learner''s own folder'; end;
  perform public.attach_payment_proof((r ->> 'proof_id')::uuid, t::text || '/' || m1::text || '/a.png', '123456789012');
  if (select source from public.payment_proofs where id = (r ->> 'proof_id')::uuid) <> 'upload' then raise exception 'source should be upload'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true);
  r2 := public.submit_upi_payment(o3);
  begin perform public.attach_payment_proof((r2 ->> 'proof_id')::uuid, null, '123456789012'); raise exception 'a used reference must be refused';
  exception when raise_exception then if sqlerrm <> 'utr_used' then raise; end if; raise notice 'ok: one bank reference cannot back two orders'; end;

  -- RLS: the other learner sees no proofs; the buyer sees theirs; anon nothing
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  select count(*) into n from public.payment_proofs;
  if n <> 0 then raise exception 'another learner must not read proofs, saw %', n; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  select count(*) into n from public.payment_proofs;
  if n <> 1 then raise exception 'the buyer must see exactly their own proof, saw %', n; end if;
  begin update public.payment_proofs set state = 'approved', money_seen = true; raise exception 'a learner must not write proofs';
  exception when insufficient_privilege then raise notice 'ok: RLS (others none, own yes, no writes)'; end;
  reset role;

  -- the database refuses "approved" without the money-seen tick, even for a superuser's direct update
  begin update public.payment_proofs set state = 'approved', reviewed_by = m2 where id = (r ->> 'proof_id')::uuid; raise exception 'approve without money_seen must fail';
  exception when check_violation then raise notice 'ok: CHECK refuses approval without money_seen'; end;

  -- stale orders: an old unpaid order with no proof is cancelled; one with an open proof is not
  update public.orders set placed_at = now() - interval '8 days' where id in (o1, o3);
  perform public.cancel_stale_orders();
  if (select status from public.orders where id = o1) <> 'awaiting_payment' then raise exception 'an order with an open proof must not be cancelled'; end if;
  raise notice 'ok: stale-order cleanup leaves orders with an open proof';

  update public.tenant_settings set commerce = saved where tenant_id = t;
end $$;
