-- =============================================================================
-- a2_member_contact.sql  —  WhatsApp number on the academy profile
-- Sign-up collects a name and a WhatsApp number, which Supabase Auth keeps in the user's metadata. Copy the
-- number onto each academy profile as it is created, whichever function creates it (join_tenant, bootstrap_tenant).
-- The number is typed by the user and never verified. Metadata is user-editable, so only a well-formed value is taken.
-- =============================================================================

create or replace function private.fill_member_phone() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.phone is null and new.user_id is not null then
    select u.raw_user_meta_data ->> 'whatsapp' into new.phone
    from auth.users u
    where u.id = new.user_id and u.raw_user_meta_data ->> 'whatsapp' ~ '^\+[1-9][0-9]{7,14}$';
  end if;
  return new;
end $$;

revoke execute on function private.fill_member_phone() from public, anon, authenticated;

create trigger tenant_members_fill_phone before insert on public.tenant_members
for each row execute function private.fill_member_phone();

-- Profiles created between the app change and this migration.
update public.tenant_members m
set phone = u.raw_user_meta_data ->> 'whatsapp'
from auth.users u
where u.id = m.user_id and m.phone is null and m.status <> 'erased'
  and u.raw_user_meta_data ->> 'whatsapp' ~ '^\+[1-9][0-9]{7,14}$';
