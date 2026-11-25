-- =============================================================================
-- 96_commerce_rest.sql  —  coupons, refunds, free (100% off) orders
-- Added in Phase 1 slice 4.
--   price_breakdown            : the one place that splits a price into subtotal / tax / total
--   apply_coupon / remove_coupon: a learner puts a coupon on their own unpaid order (re-prices it)
--   fulfil_order (replaced)    : also records the coupon redemption, and accepts a 0 total (no gateway payment)
--   begin_refund / finish_refund: SERVICE ROLE ONLY. Two steps so a gateway call never happens without a row
--                                 that remembers it: pending row -> gateway call -> processed or failed.
-- Fixed coupons: discount_value is in rupees (major units); max_discount_minor and min_order_minor are paise.
-- =============================================================================

create or replace function private.price_breakdown(p_amount bigint, p_rate numeric, p_inclusive boolean, p_discount bigint)
returns table (subtotal bigint, tax bigint, total bigint)
language plpgsql immutable set search_path = '' as $$
declare v_net bigint := greatest(p_amount - coalesce(p_discount, 0), 0);
begin
  if p_rate is null or p_rate = 0 then
    return query select v_net, 0::bigint, v_net;
  elsif p_inclusive then
    return query select v_net - round(v_net * p_rate / (100 + p_rate))::bigint, round(v_net * p_rate / (100 + p_rate))::bigint, v_net;
  else
    return query select v_net, round(v_net * p_rate / 100)::bigint, v_net + round(v_net * p_rate / 100)::bigint;
  end if;
end $$;

-- Recomputes an order (one item per order for now) for a coupon, or none. Caller has checked ownership.
create or replace function private.reprice_order(p_order public.orders, p_coupon public.coupons)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_item  public.order_items;
  v_price public.prices;
  v_tax   public.tax_rates;
  v_d     bigint := 0;
  b       record;
  b0      record;
begin
  select * into v_item from public.order_items where order_id = p_order.id order by id limit 1;
  select * into v_price from public.prices where id = v_item.price_id;
  if v_price.tax_rate_id is not null then select * into v_tax from public.tax_rates where id = v_price.tax_rate_id; end if;

  if p_coupon.id is not null then
    v_d := case p_coupon.discount_type
             when 'percent' then round(v_price.amount_minor * p_coupon.discount_value / 100)
             else round(p_coupon.discount_value * 100) end;
    if p_coupon.max_discount_minor is not null then v_d := least(v_d, p_coupon.max_discount_minor); end if;
    v_d := least(v_d, v_price.amount_minor);
  end if;

  select * into b0 from private.price_breakdown(v_price.amount_minor, v_tax.rate_pct, coalesce(v_tax.is_inclusive, true), 0);
  select * into b  from private.price_breakdown(v_price.amount_minor, v_tax.rate_pct, coalesce(v_tax.is_inclusive, true), v_d);

  update public.order_items set unit_amount_minor = b0.subtotal, discount_minor = v_d, tax_minor = b.tax, total_minor = b.total where id = v_item.id;
  update public.orders set subtotal_minor = b.subtotal, discount_minor = v_d, tax_minor = b.tax, total_minor = b.total, coupon_id = p_coupon.id
   where id = p_order.id;
  -- an amount change makes any gateway order created for the old total unusable
  update public.payments set status = 'failed', failure_reason = 'superseded' where order_id = p_order.id and status = 'created';

  return jsonb_build_object('order_id', p_order.id, 'total_minor', b.total, 'discount_minor', v_d, 'tax_minor', b.tax, 'free', b.total = 0);
end $$;

create or replace function public.apply_coupon(p_order_id uuid, p_code text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := (select auth.uid());
  v_o      public.orders;
  v_c      public.coupons;
  v_price  uuid;
  v_prod   uuid;
  v_amount bigint;
  v_used   int;
  r        jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select o.* into v_o from public.orders o join public.tenant_members m on m.id = o.member_id
   where o.id = p_order_id and m.user_id = v_uid for update of o;
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if v_o.status <> 'awaiting_payment' or exists (select 1 from public.payments p where p.order_id = v_o.id and p.status in ('captured', 'authorized')) then
    raise exception 'order_not_payable' using errcode = 'P0001';
  end if;
  if not private.feature_enabled(v_o.tenant_id, 'commerce.coupons') then raise exception 'coupon_invalid' using errcode = 'P0001'; end if;

  select * into v_c from public.coupons c where c.tenant_id = v_o.tenant_id and lower(c.code::text) = lower(trim(p_code)) and c.is_active;
  if not found then raise exception 'coupon_invalid' using errcode = 'P0001'; end if;
  if (v_c.starts_at is not null and v_c.starts_at > now()) or (v_c.ends_at is not null and v_c.ends_at < now()) then raise exception 'coupon_expired' using errcode = 'P0001'; end if;
  if v_c.max_redemptions is not null and v_c.redeemed_count >= v_c.max_redemptions then raise exception 'coupon_used_up' using errcode = 'P0001'; end if;
  select count(*) into v_used from public.coupon_redemptions cr where cr.coupon_id = v_c.id and cr.member_id = v_o.member_id;
  if v_used >= v_c.per_member_limit then raise exception 'coupon_used_up' using errcode = 'P0001'; end if;

  select oi.product_id, oi.price_id into v_prod, v_price from public.order_items oi where oi.order_id = v_o.id order by oi.id limit 1;
  if coalesce(v_c.applies_to ->> 'type', 'all') = 'products'
     and not (v_c.applies_to -> 'products') @> to_jsonb(v_prod::text) then
    raise exception 'coupon_invalid' using errcode = 'P0001';
  end if;
  select pr.amount_minor into v_amount from public.prices pr where pr.id = v_price;
  if v_c.min_order_minor is not null and v_amount < v_c.min_order_minor then raise exception 'coupon_min_order' using errcode = 'P0001'; end if;

  r := private.reprice_order(v_o, v_c);
  return r || jsonb_build_object('coupon_code', v_c.code::text);
end $$;

create or replace function public.remove_coupon(p_order_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_o public.orders; v_none public.coupons;
begin
  if (select auth.uid()) is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select o.* into v_o from public.orders o join public.tenant_members m on m.id = o.member_id
   where o.id = p_order_id and m.user_id = (select auth.uid()) for update of o;
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if v_o.status <> 'awaiting_payment' then raise exception 'order_not_payable' using errcode = 'P0001'; end if;
  return private.reprice_order(v_o, v_none);
end $$;

revoke execute on function public.apply_coupon(uuid, text), public.remove_coupon(uuid) from public, anon;
grant  execute on function public.apply_coupon(uuid, text), public.remove_coupon(uuid) to authenticated;
revoke execute on function private.reprice_order(public.orders, public.coupons), private.price_breakdown(bigint, numeric, boolean, bigint) from public;

-- ------------------------------------------------------------------ fulfil_order (v2)
create or replace function public.fulfil_order(
  p_order_id uuid, p_gateway text, p_gateway_order_id text, p_gateway_payment_id text,
  p_amount_minor bigint, p_method text default null, p_raw jsonb default '{}'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_o      public.orders;
  v_item   public.order_items;
  v_pi     record;
  v_enr    int := 0;
  v_tenant public.tenants;
begin
  select * into v_o from public.orders o where o.id = p_order_id for update;
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if v_o.status = 'paid' then
    return jsonb_build_object('order_id', v_o.id, 'status', 'paid', 'already', true);
  end if;
  if v_o.status not in ('pending', 'awaiting_payment', 'partially_paid', 'failed') then
    raise exception 'order_not_payable' using errcode = 'P0001';
  end if;
  if p_amount_minor <> v_o.total_minor then raise exception 'amount_mismatch' using errcode = 'P0001'; end if;

  -- a 100%-off order has nothing to capture
  if p_amount_minor > 0 then
    insert into public.payments (tenant_id, order_id, gateway, gateway_order_id, gateway_payment_id, amount_minor, currency, status, method, raw, paid_at)
    values (v_o.tenant_id, v_o.id, p_gateway, p_gateway_order_id, p_gateway_payment_id, p_amount_minor, v_o.currency, 'captured', p_method, p_raw, now())
    on conflict (gateway, gateway_payment_id) where gateway_payment_id is not null do nothing;
  end if;

  update public.orders set status = 'paid', amount_paid_minor = p_amount_minor, paid_at = now() where id = v_o.id;

  if v_o.coupon_id is not null then
    insert into public.coupon_redemptions (tenant_id, coupon_id, order_id, member_id, discount_minor)
    values (v_o.tenant_id, v_o.coupon_id, v_o.id, v_o.member_id, v_o.discount_minor)
    on conflict do nothing;
    if found then update public.coupons set redeemed_count = redeemed_count + 1 where id = v_o.coupon_id; end if;
  end if;

  for v_item in select * from public.order_items where order_id = v_o.id loop
    for v_pi in
      select i.course_id, c.access_duration_days as course_days, c.lesson_count, p.access_duration_days as product_days
      from public.product_items i
      join public.products p on p.id = i.product_id
      join public.courses c on c.id = i.course_id
      where i.product_id = v_item.product_id and i.course_id is not null
    loop
      if not exists (select 1 from public.enrollments e where e.tenant_id = v_o.tenant_id and e.member_id = v_o.member_id
                     and e.course_id = v_pi.course_id and e.status in ('active', 'paused', 'completed')) then
        insert into public.enrollments (tenant_id, member_id, course_id, source, order_item_id, expires_at, lessons_total)
        values (v_o.tenant_id, v_o.member_id, v_pi.course_id, case when v_o.coupon_id is not null and p_amount_minor = 0 then 'coupon' else 'purchase' end, v_item.id,
                case when coalesce(v_pi.product_days, v_pi.course_days) is not null
                     then now() + make_interval(days => coalesce(v_pi.product_days, v_pi.course_days)) end,
                v_pi.lesson_count);
        v_enr := v_enr + 1;
      end if;
    end loop;
    update public.order_items set fulfilled_at = now() where id = v_item.id;
    update public.products set sales_count = sales_count + 1 where id = v_item.product_id;
  end loop;

  select * into v_tenant from public.tenants t where t.id = v_o.tenant_id;
  insert into public.invoices (tenant_id, order_id, kind, invoice_no, seller, buyer, lines, totals)
  select v_o.tenant_id, v_o.id, 'receipt',
         'RCPT-' || to_char(now(), 'YYYY') || '-' || lpad(private.next_counter(v_o.tenant_id, 'receipt')::text, 6, '0'),
         jsonb_build_object('name', v_tenant.name),
         v_o.billing_details,
         (select coalesce(jsonb_agg(jsonb_build_object('title', oi.title_snapshot, 'quantity', oi.quantity, 'amount_minor', oi.total_minor, 'tax_minor', oi.tax_minor, 'tax', oi.tax_snapshot)), '[]'::jsonb)
            from public.order_items oi where oi.order_id = v_o.id),
         jsonb_build_object('subtotal_minor', v_o.subtotal_minor, 'discount_minor', v_o.discount_minor, 'tax_minor', v_o.tax_minor, 'total_minor', v_o.total_minor, 'currency', v_o.currency,
                            'coupon', (select c.code::text from public.coupons c where c.id = v_o.coupon_id))
  where not exists (select 1 from public.invoices i where i.order_id = v_o.id and i.kind = 'receipt');

  insert into public.outbox_events (tenant_id, event_type, aggregate_type, aggregate_id, payload)
  values (v_o.tenant_id, 'order.paid', 'order', v_o.id,
          jsonb_build_object('member_id', v_o.member_id, 'total_minor', v_o.total_minor, 'currency', v_o.currency, 'gateway', p_gateway));
  return jsonb_build_object('order_id', v_o.id, 'status', 'paid', 'already', false, 'enrollments', v_enr);
end $$;

revoke execute on function public.fulfil_order(uuid, text, text, text, bigint, text, jsonb) from public, anon, authenticated;
grant  execute on function public.fulfil_order(uuid, text, text, text, bigint, text, jsonb) to service_role;

-- ------------------------------------------------------------------ refunds
-- Step 1: validate and write a pending row. Pending refunds count against what is still refundable.
create or replace function public.begin_refund(p_order_id uuid, p_amount_minor bigint, p_reason text, p_revoke_access boolean, p_staff_member uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_o   public.orders;
  v_pay public.payments;
  v_out bigint;
  v_id  uuid;
begin
  select * into v_o from public.orders o where o.id = p_order_id for update;
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if v_o.status not in ('paid', 'partially_refunded') then raise exception 'order_not_refundable' using errcode = 'P0001'; end if;
  select * into v_pay from public.payments p where p.order_id = v_o.id and p.status in ('captured', 'partially_refunded') order by p.paid_at limit 1;
  if not found then raise exception 'order_not_refundable' using errcode = 'P0001'; end if;
  select coalesce(sum(r.amount_minor), 0) into v_out from public.refunds r where r.payment_id = v_pay.id and r.status in ('pending', 'processed');
  if p_amount_minor is null or p_amount_minor <= 0 or p_amount_minor > v_pay.amount_minor - v_out then raise exception 'refund_amount_invalid' using errcode = 'P0001'; end if;

  insert into public.refunds (tenant_id, payment_id, amount_minor, reason, status, revoke_access, initiated_by)
  values (v_o.tenant_id, v_pay.id, p_amount_minor, nullif(trim(coalesce(p_reason, '')), ''), 'pending', coalesce(p_revoke_access, true), p_staff_member)
  returning id into v_id;
  return jsonb_build_object('refund_id', v_id, 'gateway', v_pay.gateway, 'gateway_payment_id', v_pay.gateway_payment_id, 'amount_minor', p_amount_minor, 'tenant_id', v_o.tenant_id);
end $$;

-- Step 2: the gateway answered. Success settles everything; failure just closes the pending row.
create or replace function public.finish_refund(p_refund_id uuid, p_ok boolean, p_gateway_refund_id text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_r    public.refunds;
  v_pay  public.payments;
  v_o    public.orders;
  v_done bigint;
  v_full boolean;
begin
  select * into v_r from public.refunds r where r.id = p_refund_id for update;
  if not found then raise exception 'refund_not_found' using errcode = 'P0002'; end if;
  if v_r.status <> 'pending' then return jsonb_build_object('refund_id', v_r.id, 'status', v_r.status, 'already', true); end if;
  if not p_ok then
    update public.refunds set status = 'failed' where id = v_r.id;
    return jsonb_build_object('refund_id', v_r.id, 'status', 'failed');
  end if;

  update public.refunds set status = 'processed', gateway_refund_id = p_gateway_refund_id, processed_at = now() where id = v_r.id;
  select * into v_pay from public.payments p where p.id = v_r.payment_id for update;
  select * into v_o from public.orders o where o.id = v_pay.order_id for update;
  select coalesce(sum(r.amount_minor), 0) into v_done from public.refunds r where r.payment_id = v_pay.id and r.status = 'processed';
  v_full := v_done >= v_pay.amount_minor;

  update public.payments set status = case when v_full then 'refunded' else 'partially_refunded' end where id = v_pay.id;
  update public.orders set status = case when v_full then 'refunded' else 'partially_refunded' end where id = v_o.id;

  if v_r.revoke_access then
    update public.enrollments set status = 'refunded', notes = coalesce(notes, 'Refunded')
     where order_item_id in (select id from public.order_items where order_id = v_o.id) and status in ('active', 'paused', 'completed');
  end if;
  if v_full then
    update public.products set sales_count = greatest(sales_count - 1, 0) where id in (select product_id from public.order_items where order_id = v_o.id);
  end if;

  insert into public.invoices (tenant_id, order_id, kind, invoice_no, seller, buyer, lines, totals)
  select v_o.tenant_id, v_o.id, 'credit_note',
         'CN-' || to_char(now(), 'YYYY') || '-' || lpad(private.next_counter(v_o.tenant_id, 'credit_note')::text, 6, '0'),
         jsonb_build_object('name', (select t.name from public.tenants t where t.id = v_o.tenant_id)),
         v_o.billing_details,
         jsonb_build_array(jsonb_build_object('title', 'Refund for order ' || v_o.order_no, 'quantity', 1, 'amount_minor', v_r.amount_minor)),
         jsonb_build_object('total_minor', -v_r.amount_minor, 'currency', v_o.currency, 'reason', v_r.reason);

  insert into public.outbox_events (tenant_id, event_type, aggregate_type, aggregate_id, payload)
  values (v_o.tenant_id, 'order.refunded', 'order', v_o.id,
          jsonb_build_object('member_id', v_o.member_id, 'amount_minor', v_r.amount_minor, 'currency', v_o.currency, 'revoked', v_r.revoke_access));
  return jsonb_build_object('refund_id', v_r.id, 'status', 'processed', 'order_status', case when v_full then 'refunded' else 'partially_refunded' end);
end $$;

revoke execute on function public.begin_refund(uuid, bigint, text, boolean, uuid), public.finish_refund(uuid, boolean, text) from public, anon, authenticated;
grant  execute on function public.begin_refund(uuid, bigint, text, boolean, uuid), public.finish_refund(uuid, boolean, text) to service_role;
