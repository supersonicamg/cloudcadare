-- =============================================================================
-- 95_checkout.sql  —  paying for a course
-- Added in Phase 1 slice 3. Four functions:
--   save_gateway_account / read_gateway_account : the academy's own payment keys, kept in Supabase Vault.
--                                                  SERVICE ROLE ONLY (the app calls them after its own MFA check).
--   create_order(product, price)                 : a learner starts a purchase. Snapshots title, price and tax.
--   fulfil_order(...)                            : SERVICE ROLE ONLY. Called after the gateway confirmed the money
--                                                  (verified checkout signature or verified webhook). Idempotent.
-- =============================================================================

create or replace function public.save_gateway_account(
  p_tenant_id uuid, p_gateway text, p_mode text, p_public_key text, p_secret text, p_webhook_secret text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_acc  public.payment_gateway_accounts;
  v_sec  uuid;
  v_hook uuid;
  v_new  uuid;
begin
  if p_gateway not in ('razorpay', 'stripe', 'cashfree', 'phonepe', 'payu') or p_mode not in ('test', 'live') then
    raise exception 'bad_gateway' using errcode = '22023';
  end if;
  select * into v_acc from public.payment_gateway_accounts a
  where a.tenant_id = p_tenant_id and a.gateway = p_gateway and a.is_active order by a.created_at limit 1;

  if found then
    v_sec := v_acc.secret_vault_id; v_hook := v_acc.webhook_secret_vault_id;
    -- a blank secret means "keep the one we have"
    if nullif(p_secret, '') is not null then
      if v_sec is null then v_sec := vault.create_secret(p_secret, 'gw-' || p_tenant_id || '-' || p_gateway, 'payment gateway secret');
      else perform vault.update_secret(v_sec, p_secret); end if;
    end if;
    if nullif(p_webhook_secret, '') is not null then
      if v_hook is null then v_hook := vault.create_secret(p_webhook_secret, 'gwh-' || p_tenant_id || '-' || p_gateway, 'payment gateway webhook secret');
      else perform vault.update_secret(v_hook, p_webhook_secret); end if;
    end if;
    update public.payment_gateway_accounts
       set mode = p_mode, public_key = p_public_key, secret_vault_id = v_sec, webhook_secret_vault_id = v_hook, updated_at = now()
     where id = v_acc.id;
    return v_acc.id;
  end if;

  if nullif(p_secret, '') is null then raise exception 'secret_required' using errcode = '22023'; end if;
  v_sec := vault.create_secret(p_secret, 'gw-' || p_tenant_id || '-' || p_gateway, 'payment gateway secret');
  if nullif(p_webhook_secret, '') is not null then
    v_hook := vault.create_secret(p_webhook_secret, 'gwh-' || p_tenant_id || '-' || p_gateway, 'payment gateway webhook secret');
  end if;
  update public.payment_gateway_accounts set is_default = false where tenant_id = p_tenant_id;
  insert into public.payment_gateway_accounts (tenant_id, gateway, mode, public_key, secret_vault_id, webhook_secret_vault_id, is_default)
  values (p_tenant_id, p_gateway, p_mode, p_public_key, v_sec, v_hook, true) returning id into v_new;
  return v_new;
end $$;

create or replace function public.read_gateway_account(p_tenant_id uuid)
returns table (gateway text, mode text, public_key text, secret text, webhook_secret text)
language sql stable security definer set search_path = '' as $$
  select a.gateway, a.mode, a.public_key,
         (select s.decrypted_secret from vault.decrypted_secrets s where s.id = a.secret_vault_id),
         (select s.decrypted_secret from vault.decrypted_secrets s where s.id = a.webhook_secret_vault_id)
  from public.payment_gateway_accounts a
  where a.tenant_id = p_tenant_id and a.is_active and a.is_default
  limit 1
$$;

revoke execute on function public.save_gateway_account(uuid, text, text, text, text, text), public.read_gateway_account(uuid) from public, anon, authenticated;
grant  execute on function public.save_gateway_account(uuid, text, text, text, text, text), public.read_gateway_account(uuid) to service_role;

-- ------------------------------------------------------------------ create_order
create or replace function public.create_order(p_product_id uuid, p_price_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := (select auth.uid());
  v_p       public.products;
  v_price   public.prices;
  v_member  public.tenant_members;
  v_tax     public.tax_rates;
  v_order   public.orders;
  v_item    uuid;
  v_base    bigint;
  v_taxamt  bigint := 0;
  v_total   bigint;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  select * into v_p from public.products p
  where p.id = p_product_id and p.status = 'published' and p.deleted_at is null and p.visibility <> 'private';
  if not found then raise exception 'product_not_found' using errcode = 'P0002'; end if;
  if (v_p.sale_starts_at is not null and v_p.sale_starts_at > now()) or (v_p.sale_ends_at is not null and v_p.sale_ends_at < now())
     or (v_p.max_sales is not null and v_p.sales_count >= v_p.max_sales) then
    raise exception 'not_on_sale' using errcode = 'P0001';
  end if;
  if not private.feature_enabled(v_p.tenant_id, 'commerce.checkout') then raise exception 'checkout_disabled' using errcode = 'P0001'; end if;

  select * into v_member from public.tenant_members m
  where m.tenant_id = v_p.tenant_id and m.user_id = v_uid and m.status = 'active';
  if not found then raise exception 'not_a_member' using errcode = '42501'; end if;

  select * into v_price from public.prices pr
  where pr.product_id = v_p.id and pr.is_active and (p_price_id is null or pr.id = p_price_id)
  order by pr.is_default desc, pr.created_at limit 1;
  if not found then raise exception 'price_not_found' using errcode = 'P0002'; end if;
  if v_price.billing_type <> 'one_time' then raise exception 'price_unsupported' using errcode = 'P0001'; end if;

  -- nothing to buy when the member already has every course in it
  if not exists (
       select 1 from public.product_items i
       where i.product_id = v_p.id and i.course_id is not null
         and not exists (select 1 from public.enrollments e where e.member_id = v_member.id and e.course_id = i.course_id and e.status in ('active', 'paused', 'completed'))
     ) and exists (select 1 from public.product_items i where i.product_id = v_p.id and i.course_id is not null) then
    raise exception 'already_enrolled' using errcode = 'P0001';
  end if;

  -- a payment that was started a moment ago is resumed, not duplicated
  select * into v_order from public.orders o
  where o.member_id = v_member.id and o.status = 'awaiting_payment' and o.placed_at > now() - interval '30 minutes'
    and exists (select 1 from public.order_items oi where oi.order_id = o.id and oi.product_id = v_p.id and oi.price_id = v_price.id)
  order by o.placed_at desc limit 1;
  if found then
    return jsonb_build_object('order_id', v_order.id, 'order_no', v_order.order_no, 'total_minor', v_order.total_minor, 'currency', v_order.currency, 'resumed', true);
  end if;

  if v_price.tax_rate_id is not null then select * into v_tax from public.tax_rates t where t.id = v_price.tax_rate_id and t.is_active; end if;
  v_base := v_price.amount_minor;
  if v_tax.id is not null then
    if v_tax.is_inclusive then v_taxamt := round(v_base * v_tax.rate_pct / (100 + v_tax.rate_pct)); v_total := v_base;
    else v_taxamt := round(v_base * v_tax.rate_pct / 100); v_total := v_base + v_taxamt; end if;
  else v_total := v_base; end if;
  if v_total <= 0 then raise exception 'price_unsupported' using errcode = 'P0001'; end if;

  insert into public.orders (tenant_id, order_no, member_id, status, currency, subtotal_minor, tax_minor, total_minor, billing_details, source, created_by)
  values (v_p.tenant_id,
          'ORD-' || to_char(now(), 'YYYY') || '-' || lpad(private.next_counter(v_p.tenant_id, 'order')::text, 6, '0'),
          v_member.id, 'awaiting_payment', v_price.currency, v_total - v_taxamt, v_taxamt, v_total,
          jsonb_build_object('name', v_member.display_name, 'email', v_member.email, 'phone', v_member.phone), 'web', v_member.id)
  returning * into v_order;

  insert into public.order_items (tenant_id, order_id, product_id, price_id, title_snapshot, unit_amount_minor, tax_minor, total_minor, tax_snapshot)
  values (v_p.tenant_id, v_order.id, v_p.id, v_price.id, v_p.title, v_total - v_taxamt, v_taxamt, v_total,
          case when v_tax.id is null then '{}'::jsonb
               else jsonb_build_object('name', v_tax.name, 'rate_pct', v_tax.rate_pct, 'inclusive', v_tax.is_inclusive, 'hsn_sac', v_tax.hsn_sac_code) end)
  returning id into v_item;

  return jsonb_build_object('order_id', v_order.id, 'order_no', v_order.order_no, 'total_minor', v_order.total_minor, 'currency', v_order.currency, 'resumed', false);
end $$;

revoke execute on function public.create_order(uuid, uuid) from public, anon;
grant  execute on function public.create_order(uuid, uuid) to authenticated;

-- ------------------------------------------------------------------ fulfil_order
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
  v_n      int;
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

  insert into public.payments (tenant_id, order_id, gateway, gateway_order_id, gateway_payment_id, amount_minor, currency, status, method, raw, paid_at)
  values (v_o.tenant_id, v_o.id, p_gateway, p_gateway_order_id, p_gateway_payment_id, p_amount_minor, v_o.currency, 'captured', p_method, p_raw, now())
  on conflict (gateway, gateway_payment_id) where gateway_payment_id is not null do nothing;

  update public.orders set status = 'paid', amount_paid_minor = p_amount_minor, paid_at = now() where id = v_o.id;

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
        values (v_o.tenant_id, v_o.member_id, v_pi.course_id, 'purchase', v_item.id,
                case when coalesce(v_pi.product_days, v_pi.course_days) is not null
                     then now() + make_interval(days => coalesce(v_pi.product_days, v_pi.course_days)) end,
                v_pi.lesson_count);
        v_enr := v_enr + 1;
      end if;
    end loop;
    update public.order_items set fulfilled_at = now() where id = v_item.id;
    update public.products set sales_count = sales_count + 1 where id = v_item.product_id;
  end loop;

  -- A receipt now. A GST tax invoice (GSTIN, CGST/SGST/IGST split, FY numbering) needs the academy's GST details.
  select * into v_tenant from public.tenants t where t.id = v_o.tenant_id;
  insert into public.invoices (tenant_id, order_id, kind, invoice_no, seller, buyer, lines, totals)
  select v_o.tenant_id, v_o.id, 'receipt',
         'RCPT-' || to_char(now(), 'YYYY') || '-' || lpad(private.next_counter(v_o.tenant_id, 'receipt')::text, 6, '0'),
         jsonb_build_object('name', v_tenant.name),
         v_o.billing_details,
         (select coalesce(jsonb_agg(jsonb_build_object('title', oi.title_snapshot, 'quantity', oi.quantity, 'amount_minor', oi.total_minor, 'tax_minor', oi.tax_minor, 'tax', oi.tax_snapshot)), '[]'::jsonb)
            from public.order_items oi where oi.order_id = v_o.id),
         jsonb_build_object('subtotal_minor', v_o.subtotal_minor, 'tax_minor', v_o.tax_minor, 'total_minor', v_o.total_minor, 'currency', v_o.currency)
  where not exists (select 1 from public.invoices i where i.order_id = v_o.id);

  insert into public.outbox_events (tenant_id, event_type, aggregate_type, aggregate_id, payload)
  values (v_o.tenant_id, 'order.paid', 'order', v_o.id,
          jsonb_build_object('member_id', v_o.member_id, 'total_minor', v_o.total_minor, 'currency', v_o.currency, 'gateway', p_gateway));
  return jsonb_build_object('order_id', v_o.id, 'status', 'paid', 'already', false, 'enrollments', v_enr);
end $$;

revoke execute on function public.fulfil_order(uuid, text, text, text, bigint, text, jsonb) from public, anon, authenticated;
grant  execute on function public.fulfil_order(uuid, text, text, text, bigint, text, jsonb) to service_role;

-- Who may see and manage the academy's payment account: the people who set prices and taxes.
-- (The plan used `integration.manage`, but that belongs to the developer-integrations feature, which payments
-- do not depend on. Permissions are copied into each tenant's roles when the tenant is created, so a new
-- permission would not reach existing academies; `price.manage` already exists, is sensitive and needs MFA.)
drop policy if exists payment_gateway_accounts_select on public.payment_gateway_accounts;
create policy payment_gateway_accounts_select on public.payment_gateway_accounts for select to authenticated
  using (tenant_id in (select private.perm_tenants('price.manage')));
