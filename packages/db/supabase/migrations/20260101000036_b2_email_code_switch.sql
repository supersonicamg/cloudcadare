-- =============================================================================
-- b2_email_code_switch.sql  —  a per-academy switch for the 6-digit email code (migration 28)
--
-- An academy with no mail server yet (a testing period) cannot send the code, so nobody could finish signing up or
-- pay. Setting tenant_settings.learning.email_code = "off" removes the step. Missing or any other value = required.
--
--   Off: sign-up goes straight in, and "I have paid" (UPI) no longer asks for a confirmed email. Staff still check
--        the money before anything opens.
--   Unchanged either way: the learner list. It gives access by email alone, so it only ever matches an address that
--        was proven by a code. With the switch off, staff grant that access by hand.
--
--   Turn off:  update public.tenant_settings set learning = learning || '{"email_code":"off"}' where tenant_id = '…';
--   Turn on:   update public.tenant_settings set learning = learning - 'email_code'            where tenant_id = '…';
-- =============================================================================

create or replace function public.email_code_required(p_tenant_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select s.learning ->> 'email_code' from public.tenant_settings s where s.tenant_id = p_tenant_id), 'on') <> 'off'
$$;
revoke all on function public.email_code_required(uuid) from public, anon;
grant execute on function public.email_code_required(uuid) to authenticated, service_role;

create or replace function public.submit_upi_payment(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_o     public.orders;
  v_m     public.tenant_members;
  v_upi   jsonb;
  v_paid  bigint;
  v_bal   bigint;
  v_proof public.payment_proofs;
  v_pid   uuid;
begin
  select * into v_o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  select * into v_m from public.tenant_members where id = v_o.member_id and user_id = (select auth.uid()) and status = 'active';
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if v_m.email_verified_at is null and public.email_code_required(v_o.tenant_id) then
    raise exception 'email_not_confirmed' using errcode = 'P0001';
  end if;
  if v_o.status not in ('awaiting_payment', 'partially_paid') then raise exception 'order_not_payable' using errcode = 'P0001'; end if;

  select s.commerce -> 'upi' into v_upi from public.tenant_settings s where s.tenant_id = v_o.tenant_id;
  if coalesce(v_upi ->> 'enabled', 'false') <> 'true' then raise exception 'upi_not_enabled' using errcode = 'P0001'; end if;

  select * into v_proof from public.payment_proofs where order_id = v_o.id and state = 'pending_review';
  if found then return jsonb_build_object('proof_id', v_proof.id, 'payment_id', v_proof.payment_id, 'already', true); end if;

  select coalesce(sum(p.amount_minor), 0) into v_paid from public.payments p where p.order_id = v_o.id and p.status = 'captured';
  v_bal := v_o.total_minor - v_paid;
  if v_bal <= 0 then raise exception 'nothing_due' using errcode = 'P0001'; end if;

  -- gateway_payment_id = the row's own id, so approving can hand the same row to fulfil_order without a second payment.
  v_pid := private.uuid7();
  insert into public.payments (id, tenant_id, order_id, gateway, gateway_payment_id, amount_minor, currency, status, method)
  values (v_pid, v_o.tenant_id, v_o.id, 'upi_manual', v_pid::text, v_bal, v_o.currency, 'created', 'upi');
  insert into public.payment_proofs (tenant_id, order_id, payment_id, member_id, amount_minor)
  values (v_o.tenant_id, v_o.id, v_pid, v_m.id, v_bal) returning * into v_proof;

  insert into public.outbox_events (tenant_id, event_type, aggregate_type, aggregate_id, payload)
  values (v_o.tenant_id, 'payment.pending', 'order', v_o.id, jsonb_build_object('member_id', v_m.id, 'proof_id', v_proof.id, 'amount_minor', v_bal));
  return jsonb_build_object('proof_id', v_proof.id, 'payment_id', v_pid, 'already', false);
end $$;
