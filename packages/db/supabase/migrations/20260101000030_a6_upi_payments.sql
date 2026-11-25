-- =============================================================================
-- a6_upi_payments.sql  —  manual UPI payments with a screenshot to verify (plan/16 §3.3, §5)
-- The learner scans a QR, pays, and presses "I have paid". That creates a `payments` row (gateway 'upi_manual', status
-- 'created') and ONE open `payment_proofs` row. Staff then check the money and approve (migration 31). Until then
-- nothing is unlocked. Settings live in tenant_settings.commerce.upi (no new settings table).
-- =============================================================================

-- ---------------------------------------------------------------- permission
insert into public.permission_catalog (key, feature_key, group_name, description, is_sensitive) values
  ('payment.verify', 'commerce.checkout', 'Sales', 'Verify UPI payments', true)
on conflict (key) do update set description = excluded.description, feature_key = excluded.feature_key, is_sensitive = excluded.is_sensitive;
update private.role_templates set permissions = array_append(permissions, 'payment.verify')
 where key = 'accountant' and not 'payment.verify' = any (permissions);
-- Roles that were copied into academies before this migration (owner and admin hold '*' and need nothing).
insert into public.role_permissions (tenant_id, role_id, permission_key)
select r.tenant_id, r.id, 'payment.verify' from public.roles r where r.key = 'accountant'
on conflict do nothing;

-- ---------------------------------------------------------------- the proof of payment
create table public.payment_proofs (
  id             uuid primary key default private.uuid7(),
  tenant_id      uuid not null,
  order_id       uuid not null,
  payment_id     uuid not null,
  member_id      uuid not null,
  state          text not null default 'pending_review' check (state in ('pending_review', 'approved', 'rejected', 'superseded')),
  source         text not null default 'whatsapp' check (source in ('whatsapp', 'upload')),
  file_path      text,
  utr            text check (utr is null or utr ~ '^[0-9]{12}$'),
  amount_minor   bigint not null check (amount_minor > 0),
  whatsapp_seen  boolean not null default false,
  money_seen     boolean not null default false,
  reject_reason  text check (reject_reason in ('amount_mismatch', 'not_received', 'screenshot_unclear', 'wrong_account', 'duplicate')),
  reject_note    text,
  reviewed_by    uuid,
  reviewed_at    timestamptz,
  submitted_at   timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, order_id)   references public.orders(tenant_id, id)   on delete restrict,
  foreign key (tenant_id, payment_id) references public.payments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, member_id)  references public.tenant_members(tenant_id, id) on delete cascade,
  -- A screenshot can be faked, the money in the account cannot: nothing is approved without the "money seen" tick.
  check (state <> 'approved' or (money_seen and reviewed_by is not null)),
  check (state <> 'rejected' or reject_reason is not null)
);
create index payment_proofs_queue_idx on public.payment_proofs (tenant_id, state, submitted_at) where state = 'pending_review';
create index payment_proofs_member_idx on public.payment_proofs (member_id, submitted_at desc);
create unique index payment_proofs_one_open_uk on public.payment_proofs (order_id) where state = 'pending_review';
-- One bank reference is one payment: it cannot back two orders.
create unique index payment_proofs_utr_uk on public.payment_proofs (tenant_id, utr) where utr is not null and state in ('pending_review', 'approved');
create unique index payment_proofs_payment_uk on public.payment_proofs (payment_id);

alter table public.payment_proofs enable row level security;
create policy payment_proofs_select on public.payment_proofs for select to authenticated
  using (member_id in (select private.my_member_ids())
         or tenant_id in (select private.perm_tenants('payment.verify'))
         or tenant_id in (select private.perm_tenants('order.view')));
grant select on public.payment_proofs to authenticated;
-- No insert, update or delete grant: every change goes through the functions below and in migration 31.

-- ---------------------------------------------------------------- the private bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do nothing;
-- Path: {tenant_id}/{member_id}/{uuid}.{ext}. A learner writes and reads only their own folder; staff who verify read the academy's.
create policy "payment-proofs owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[2] in (select m::text from private.my_member_ids() m)
              and (storage.foldername(name))[1] in (select t::text from private.my_tenant_ids() t));
create policy "payment-proofs owner read" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and (storage.foldername(name))[2] in (select m::text from private.my_member_ids() m));
create policy "payment-proofs staff read" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] in (select t::text from private.perm_tenants('payment.verify') t));

-- ---------------------------------------------------------------- learner: "I have paid"
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
  if v_m.email_verified_at is null then raise exception 'email_not_confirmed' using errcode = 'P0001'; end if;
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

-- Optional: the learner uploads the screenshot here instead of sending it on WhatsApp, and may type the 12-digit bank reference.
create or replace function public.attach_payment_proof(p_proof_id uuid, p_file_path text, p_utr text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_p   public.payment_proofs;
  v_utr text := nullif(regexp_replace(coalesce(p_utr, ''), '\s', '', 'g'), '');
  v_path text := nullif(btrim(coalesce(p_file_path, '')), '');
begin
  select p.* into v_p from public.payment_proofs p join public.tenant_members m on m.id = p.member_id
   where p.id = p_proof_id and m.user_id = (select auth.uid()) for update of p;
  if not found then raise exception 'proof_not_found' using errcode = 'P0002'; end if;
  if v_p.state <> 'pending_review' then raise exception 'proof_closed' using errcode = 'P0001'; end if;
  if v_utr is not null and v_utr !~ '^[0-9]{12}$' then raise exception 'invalid_utr' using errcode = '22023'; end if;
  if v_path is not null and (v_path not like v_p.tenant_id::text || '/' || v_p.member_id::text || '/%' or v_path like '%..%') then
    raise exception 'invalid_path' using errcode = '22023';
  end if;
  begin
    update public.payment_proofs
       set source = case when v_path is not null then 'upload' else source end,
           file_path = coalesce(v_path, file_path), utr = coalesce(v_utr, utr)
     where id = v_p.id;
  exception when unique_violation then
    raise exception 'utr_used' using errcode = 'P0001';
  end;
end $$;

revoke all on function public.submit_upi_payment(uuid), public.attach_payment_proof(uuid, text, text) from public, anon;
grant execute on function public.submit_upi_payment(uuid), public.attach_payment_proof(uuid, text, text) to authenticated;

-- Unpaid orders nobody came back to are cancelled after 7 days (called by the cron route; service role only).
create or replace function public.cancel_stale_orders() returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  update public.orders o set status = 'cancelled'
   where o.status = 'awaiting_payment' and o.placed_at < now() - interval '7 days'
     and not exists (select 1 from public.payment_proofs p where p.order_id = o.id and p.state = 'pending_review')
     and not exists (select 1 from public.payments p where p.order_id = o.id and p.status = 'captured');
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.cancel_stale_orders() from public, anon, authenticated;
grant execute on function public.cancel_stale_orders() to service_role;

-- ---------------------------------------------------------------- messages
insert into public.notification_templates (tenant_id, event_key, channel, subject, body) values
  (null, 'payment.pending', 'email', 'We are checking your payment ({{order.no}})',
   E'Hi {{member.name}},\n\nThank you. We have your payment note for order {{order.no}} and we are checking it. {{payment.sla}}\n\nNeed to send the screenshot? {{links.order}}'),
  (null, 'payment.needs_action', 'email', 'About your payment ({{order.no}})',
   E'Hi {{member.name}},\n\nWe could not match your payment for order {{order.no}}.\n\n{{payment.reason}}\n\nWhat to do next: {{links.order}}')
on conflict do nothing;
insert into public.notification_templates (tenant_id, event_key, channel, subject, body)
select t.id, g.event_key, g.channel, g.subject, g.body
from public.tenants t cross join public.notification_templates g
where g.tenant_id is null and g.event_key in ('payment.pending', 'payment.needs_action')
on conflict do nothing;
