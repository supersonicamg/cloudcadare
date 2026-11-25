-- =============================================================================
-- a8_upi_review.sql  —  staff approve or reject a UPI payment (plan/16 §5.3, §5.4)
-- Slice 5. The learner pressed "I have paid" (migration 30) and a `payment_proofs` row waits in `pending_review`.
-- Approving is the ONLY way a manual UPI payment turns into access. Rules, all enforced here and not in the app:
--   * the caller holds `payment.verify` in this academy AND the session is at aal2 (authenticator step-up);
--   * "I can see this payment in our UPI app or bank" must be ticked (the table CHECK is the last backstop), and for
--     proofs the learner sent on WhatsApp the reviewer also ticks "I saw the screenshot on WhatsApp";
--   * nobody approves their own order;
--   * idempotent: a proof that is no longer `pending_review` returns what it became and changes nothing;
--   * the order becomes `paid` (and the learner is enrolled, by the existing `fulfil_order`) only when captured
--     payments reach the order total. A shortfall leaves the order `partially_paid`; the next QR is for the balance.
-- =============================================================================

-- ---------------------------------------------------------------- the owner can verify
-- Migration 30 assumed owner and admin "hold everything". They do not: the '*' of a role template is expanded into one
-- role_permissions row per catalog key when an academy is created, so academies created before a permission existed
-- never got it. Without this, the owner of the first academy could not approve a payment.
insert into public.role_permissions (tenant_id, role_id, permission_key)
select r.tenant_id, r.id, 'payment.verify' from public.roles r where r.key in ('owner', 'admin')
on conflict do nothing;

-- ---------------------------------------------------------------- approve
create or replace function public.approve_upi_payment(p_proof uuid, p_money_seen boolean default false, p_whatsapp_seen boolean default false)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid      uuid := (select auth.uid());
  v_proof    public.payment_proofs;
  v_order    public.orders;
  v_buyer    uuid;
  v_reviewer uuid;
  v_captured bigint;
  v_status   text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into v_proof from public.payment_proofs where id = p_proof;
  if not found then raise exception 'proof_not_found' using errcode = 'P0002'; end if;
  if not private.has_perm(v_proof.tenant_id, 'payment.verify') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', '') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  select id into v_reviewer from public.tenant_members where tenant_id = v_proof.tenant_id and user_id = v_uid and status = 'active';
  if v_reviewer is null then raise exception 'not_allowed' using errcode = '42501'; end if;

  -- Lock the order first, then the proof (the same order as "I have paid"), then look again: another reviewer may have been faster.
  select * into v_order from public.orders where id = v_proof.order_id for update;
  select * into v_proof from public.payment_proofs where id = p_proof for update;
  if v_proof.state <> 'pending_review' then
    return jsonb_build_object('state', v_proof.state, 'order_status', v_order.status, 'already', true);
  end if;

  select user_id into v_buyer from public.tenant_members where id = v_proof.member_id;
  if v_buyer = v_uid then raise exception 'own_order' using errcode = 'P0001'; end if;

  if not coalesce(p_money_seen, false) then raise exception 'money_not_seen' using errcode = 'P0001'; end if;
  if v_proof.source = 'whatsapp' and not coalesce(p_whatsapp_seen, false) then raise exception 'whatsapp_not_seen' using errcode = 'P0001'; end if;
  if v_order.status not in ('awaiting_payment', 'partially_paid') then raise exception 'order_not_payable' using errcode = 'P0001'; end if;

  update public.payments set status = 'captured', paid_at = now(), updated_at = now() where id = v_proof.payment_id;
  select coalesce(sum(p.amount_minor), 0) into v_captured from public.payments p where p.order_id = v_order.id and p.status = 'captured';

  if v_captured >= v_order.total_minor then
    -- The payment row already carries gateway_payment_id = its own id, so fulfil_order's insert is a no-op: it only marks
    -- the order paid, enrols the learner, writes the receipt and queues the "order.paid" email.
    perform public.fulfil_order(v_order.id, 'upi_manual', null, v_proof.payment_id::text, v_order.total_minor, 'upi', '{}'::jsonb);
    v_status := 'paid';
  else
    update public.orders set status = 'partially_paid', amount_paid_minor = v_captured where id = v_order.id;
    v_status := 'partially_paid';
  end if;

  update public.payment_proofs
     set state = 'approved', money_seen = true, whatsapp_seen = coalesce(p_whatsapp_seen, false) or whatsapp_seen,
         reviewed_by = v_reviewer, reviewed_at = now()
   where id = v_proof.id;

  insert into public.audit_logs (tenant_id, actor_user_id, actor_member_id, action, entity_type, entity_id, changes)
  values (v_proof.tenant_id, v_uid, v_reviewer, 'payment.upi_approved', 'payment_proof', v_proof.id,
          jsonb_build_object('order_id', v_order.id, 'order_no', v_order.order_no, 'amount_minor', v_proof.amount_minor,
                             'captured_minor', v_captured, 'order_status', jsonb_build_array(v_order.status, v_status),
                             'source', v_proof.source));
  return jsonb_build_object('state', 'approved', 'order_status', v_status, 'already', false, 'captured_minor', v_captured);
end $$;

-- ---------------------------------------------------------------- reject
create or replace function public.reject_upi_payment(p_proof uuid, p_reason text, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid      uuid := (select auth.uid());
  v_proof    public.payment_proofs;
  v_order    public.orders;
  v_reviewer uuid;
  v_note     text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_reason is null or p_reason not in ('amount_mismatch', 'not_received', 'screenshot_unclear', 'wrong_account', 'duplicate') then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 500 then raise exception 'note_too_long' using errcode = '22023'; end if;
  select * into v_proof from public.payment_proofs where id = p_proof;
  if not found then raise exception 'proof_not_found' using errcode = 'P0002'; end if;
  if not private.has_perm(v_proof.tenant_id, 'payment.verify') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', '') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  select id into v_reviewer from public.tenant_members where tenant_id = v_proof.tenant_id and user_id = v_uid and status = 'active';
  if v_reviewer is null then raise exception 'not_allowed' using errcode = '42501'; end if;

  select * into v_order from public.orders where id = v_proof.order_id for update;
  select * into v_proof from public.payment_proofs where id = p_proof for update;
  if v_proof.state <> 'pending_review' then
    return jsonb_build_object('state', v_proof.state, 'order_status', v_order.status, 'already', true);
  end if;

  update public.payment_proofs
     set state = 'rejected', reject_reason = p_reason, reject_note = v_note, reviewed_by = v_reviewer, reviewed_at = now()
   where id = v_proof.id;
  update public.payments set status = 'failed', failure_reason = p_reason, updated_at = now() where id = v_proof.payment_id and status = 'created';
  -- The order stays as it was (awaiting_payment, or partially_paid when an earlier part was approved): the learner can try again.

  insert into public.audit_logs (tenant_id, actor_user_id, actor_member_id, action, entity_type, entity_id, changes)
  values (v_proof.tenant_id, v_uid, v_reviewer, 'payment.upi_rejected', 'payment_proof', v_proof.id,
          jsonb_build_object('order_id', v_order.id, 'order_no', v_order.order_no, 'amount_minor', v_proof.amount_minor, 'reason', p_reason, 'note', v_note));
  insert into public.outbox_events (tenant_id, event_type, aggregate_type, aggregate_id, payload)
  values (v_proof.tenant_id, 'payment.needs_action', 'order', v_order.id,
          jsonb_build_object('member_id', v_proof.member_id, 'proof_id', v_proof.id, 'reason', p_reason, 'note', v_note, 'amount_minor', v_proof.amount_minor));
  return jsonb_build_object('state', 'rejected', 'order_status', v_order.status, 'already', false);
end $$;

revoke all on function public.approve_upi_payment(uuid, boolean, boolean), public.reject_upi_payment(uuid, text, text) from public, anon;
grant execute on function public.approve_upi_payment(uuid, boolean, boolean), public.reject_upi_payment(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------- messages
-- "payment.pending" and "payment.needs_action" exist (migration 30); the receipt for an approved payment is the existing
-- "order.receipt" mail that fulfil_order queues. Here the needs-action text gets the reason variables used by the worker.
update public.notification_templates
   set body = E'Hi {{member.name}},\n\nWe could not match your payment for order {{order.no}}.\n\n{{payment.reason}}{{payment.note}}\n\nWhat to do next: {{links.order}}'
 where event_key = 'payment.needs_action' and channel = 'email' and body not like '%{{payment.note}}%';
