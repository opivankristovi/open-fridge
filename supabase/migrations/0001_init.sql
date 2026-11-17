-- Open Fridge: initial schema
-- Run once in the Supabase SQL editor (or `supabase db push`).
-- Security model: every row belongs to a household; only members of that
-- household can read or write it. Households are created / joined only via
-- the security-definer RPCs below, never by direct inserts.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique check (invite_code ~ '^[A-Z2-9]{6}$'),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id);

create table public.items (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households (id) on delete cascade,
  added_by          uuid references auth.users (id) on delete set null default auth.uid(),
  name              text not null check (char_length(name) between 1 and 120),
  brand             text check (char_length(brand) <= 120),
  barcode           text check (barcode ~ '^[0-9]{6,14}$'),
  photo_path        text,
  image_url         text check (image_url ~ '^https://'),
  category          text not null default 'overig' check (category in
                      ('groenten','fruit','vlees','vis','zuivel','kaas','restjes','sauzen','dranken','overig')),
  quantity          integer not null default 1 check (quantity between 1 and 999),
  added_at          timestamptz not null default now(),
  expiry_date       date,
  opened_at         timestamptz,
  opened_shelf_days integer check (opened_shelf_days between 0 and 3650),
  fresh_shelf_days  integer check (fresh_shelf_days between 0 and 3650),
  status            text not null default 'in_fridge' check (status in ('in_fridge','consumed','discarded')),
  removed_at        timestamptz,
  removed_by        uuid references auth.users (id) on delete set null,
  updated_at        timestamptz not null default now()
);
create index items_household_status_idx on public.items (household_id, status);

create table public.household_products (
  household_id           uuid not null references public.households (id) on delete cascade,
  barcode                text not null check (barcode ~ '^[0-9]{6,14}$'),
  name                   text not null check (char_length(name) between 1 and 120),
  brand                  text check (char_length(brand) <= 120),
  image_url              text check (image_url ~ '^https://'),
  category               text not null default 'overig',
  last_opened_shelf_days integer check (last_opened_shelf_days between 0 and 3650),
  updated_at             timestamptz not null default now(),
  primary key (household_id, barcode)
);

create table public.household_settings (
  household_id      uuid primary key references public.households (id) on delete cascade,
  category_defaults jsonb not null default '{}'::jsonb check (jsonb_typeof(category_defaults) = 'object'),
  updated_at        timestamptz not null default now()
);

-- updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger items_touch before update on public.items
  for each row execute function public.touch_updated_at();
create trigger household_products_touch before update on public.household_products
  for each row execute function public.touch_updated_at();
create trigger household_settings_touch before update on public.household_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Membership helpers (security definer: avoids RLS recursion on members table)
-- ---------------------------------------------------------------------------

create or replace function public.is_member(hid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = (select auth.uid())
  );
$$;

-- For storage paths "{household_id}/{file}": false instead of an error on junk.
create or replace function public.is_member_path(first_segment text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  return public.is_member(first_segment::uuid);
exception when invalid_text_representation then
  return false;
end $$;

create or replace function public.new_invite_code()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 chars, no 0/O/1/I
  bytes bytea := extensions.gen_random_bytes(6);
  code text := '';
begin
  for i in 0..5 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return code;
end $$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_household(p_name text, p_display_name text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  loop
    begin
      insert into public.households (name, invite_code, created_by)
      values (trim(p_name), public.new_invite_code(), uid)
      returning id into hid;
      exit;
    exception when unique_violation then
      -- invite code collision: try again
    end;
  end loop;
  insert into public.household_members (household_id, user_id, display_name, role)
  values (hid, uid, trim(p_display_name), 'owner');
  insert into public.household_settings (household_id) values (hid);
  return hid;
end $$;

create or replace function public.join_household(p_code text, p_display_name text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  hid uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select id into hid from public.households where invite_code = upper(trim(p_code));
  if hid is null then raise exception 'invalid_code'; end if;
  insert into public.household_members (household_id, user_id, display_name, role)
  values (hid, uid, trim(p_display_name), 'member')
  on conflict (household_id, user_id) do update set display_name = excluded.display_name;
  return hid;
end $$;

-- Owner can rotate the invite code (e.g. if it leaked).
create or replace function public.regenerate_invite_code(p_household_id uuid)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  code text;
begin
  if not exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'not_owner';
  end if;
  loop
    begin
      code := public.new_invite_code();
      update public.households set invite_code = code where id = p_household_id;
      exit;
    exception when unique_violation then
    end;
  end loop;
  return code;
end $$;

revoke all on function public.is_member(uuid), public.is_member_path(text), public.new_invite_code(),
  public.create_household(text, text), public.join_household(text, text),
  public.regenerate_invite_code(uuid) from public, anon;
grant execute on function public.is_member(uuid), public.is_member_path(text),
  public.create_household(text, text), public.join_household(text, text),
  public.regenerate_invite_code(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges + Row Level Security
-- ---------------------------------------------------------------------------

alter table public.households         enable row level security;
alter table public.household_members  enable row level security;
alter table public.items              enable row level security;
alter table public.household_products enable row level security;
alter table public.household_settings enable row level security;

revoke all on public.households, public.household_members, public.items,
  public.household_products, public.household_settings from anon, authenticated;

-- households: members read; only the name may be changed directly.
grant select on public.households to authenticated;
grant update (name) on public.households to authenticated;
create policy households_select on public.households for select to authenticated
  using (public.is_member(id));
create policy households_update on public.households for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));

-- household_members: members see each other; you may rename or remove yourself.
grant select, delete on public.household_members to authenticated;
grant update (display_name) on public.household_members to authenticated;
create policy members_select on public.household_members for select to authenticated
  using (public.is_member(household_id));
create policy members_update_self on public.household_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy members_delete_self on public.household_members for delete to authenticated
  using (user_id = (select auth.uid()));

-- items: full access for members; household_id / added_by are immutable.
grant select, insert, delete on public.items to authenticated;
grant update (name, brand, barcode, photo_path, image_url, category, quantity, added_at,
  expiry_date, opened_at, opened_shelf_days, fresh_shelf_days, status, removed_at, removed_by)
  on public.items to authenticated;
create policy items_select on public.items for select to authenticated
  using (public.is_member(household_id));
create policy items_insert on public.items for insert to authenticated
  with check (public.is_member(household_id) and added_by = (select auth.uid()));
create policy items_update on public.items for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy items_delete on public.items for delete to authenticated
  using (public.is_member(household_id));

-- household_products: members' shared product memory.
grant select, insert, update, delete on public.household_products to authenticated;
create policy products_all on public.household_products for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

-- household_settings: members read and edit (row is created by create_household).
grant select, update (category_defaults) on public.household_settings to authenticated;
create policy settings_select on public.household_settings for select to authenticated
  using (public.is_member(household_id));
create policy settings_update on public.household_settings for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

-- ---------------------------------------------------------------------------
-- Realtime (postgres_changes respects RLS for SELECT)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.items;

-- ---------------------------------------------------------------------------
-- Storage: private bucket, path "{household_id}/{item_id}.jpg"
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

create policy photos_select on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.is_member_path((storage.foldername(name))[1]));
create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_member_path((storage.foldername(name))[1]));
create policy photos_update on storage.objects for update to authenticated
  using (bucket_id = 'photos' and public.is_member_path((storage.foldername(name))[1]))
  with check (bucket_id = 'photos' and public.is_member_path((storage.foldername(name))[1]));
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.is_member_path((storage.foldername(name))[1]));
