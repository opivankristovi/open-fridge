-- Open Fridge: storage locations (fridges, freezers, pantries, cellars, storage rooms)
-- Run once in the Supabase SQL editor, AFTER 0001_init.sql. Needs Postgres 15+
-- ("on delete set null (column)"); new Supabase projects are on 15 or later.
-- Existing installs: run only this file. Existing data is kept: every household
-- gets one fridge location and all its items are placed in it.
-- Older app versions can keep adding/removing items, but they crash on items in the
-- new categories (droogwaren, conserven, brood, maaltijden, snacks): update every
-- phone in the household before using those.

begin;

-- ---------------------------------------------------------------------------
-- Locations
-- ---------------------------------------------------------------------------

create table if not exists public.storage_locations (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- null = show the (translated) label of the kind, e.g. "Koelkast"
  name         text check (name is null or char_length(name) between 1 and 40),
  kind         text not null check (kind in ('fridge','freezer','pantry','cellar','storage_room','other')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- target of the composite FK from items, so an item can only point to a location of its own household
  unique (household_id, id)
);
create index if not exists storage_locations_household_idx on public.storage_locations (household_id);

create trigger storage_locations_touch before update on public.storage_locations
  for each row execute function public.touch_updated_at();

-- One fridge for every existing household.
insert into public.storage_locations (household_id, kind)
select h.id, 'fridge' from public.households h
where not exists (select 1 from public.storage_locations l where l.household_id = h.id);

-- Default location of a household: its oldest fridge, else its oldest location.
-- Security invoker on purpose: RLS limits it to the caller's own households.
create or replace function public.default_location(hid uuid)
returns uuid language sql stable set search_path = '' as $$
  select l.id from public.storage_locations l
  where l.household_id = hid
  order by (l.kind = 'fridge') desc, l.created_at, l.id
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Items: location + "stored since" (clock for shelf life after a move)
-- ---------------------------------------------------------------------------

alter table public.items add column if not exists location_id uuid;
alter table public.items add column if not exists stored_at timestamptz;

update public.items set stored_at = added_at where stored_at is null;
alter table public.items alter column stored_at set default now();
alter table public.items alter column stored_at set not null;

update public.items set location_id = public.default_location(household_id) where location_id is null;

-- History rows keep a null location when their location is deleted; items in stock never do.
alter table public.items
  add constraint items_location_fk foreign key (household_id, location_id)
  references public.storage_locations (household_id, id) on delete set null (location_id);
alter table public.items
  add constraint items_location_when_in_stock check (status <> 'in_fridge' or location_id is not null);
create index if not exists items_location_idx on public.items (location_id);

-- Older app versions do not send a location (insert) and restore history rows whose
-- location may be gone (update): put those in the household's default location.
create or replace function public.items_default_location()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'in_fridge' and new.location_id is null then
    new.location_id := public.default_location(new.household_id);
  end if;
  return new;
end $$;

drop trigger if exists items_default_location on public.items;
create trigger items_default_location before insert or update on public.items
  for each row execute function public.items_default_location();

-- More categories for pantry / cellar / freezer food.
alter table public.items drop constraint if exists items_category_check;
alter table public.items add constraint items_category_check check (category in
  ('groenten','fruit','vlees','vis','zuivel','kaas','restjes','sauzen','dranken','overig',
   'droogwaren','conserven','brood','maaltijden','snacks'));

-- ---------------------------------------------------------------------------
-- Shelf-life defaults per location kind: { "<kind>": { "<category>": {fresh, opened} } }
-- The old fridge-only category_defaults become the "fridge" entry (the old column is left
-- untouched so older app versions keep working).
-- ---------------------------------------------------------------------------

alter table public.household_settings
  add column if not exists shelf_defaults jsonb not null default '{}'::jsonb
  check (jsonb_typeof(shelf_defaults) = 'object');

update public.household_settings
set shelf_defaults = jsonb_build_object('fridge', category_defaults)
where shelf_defaults = '{}'::jsonb and category_defaults <> '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- New households start with one fridge.
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
  insert into public.storage_locations (household_id, kind) values (hid, 'fridge');
  return hid;
end $$;

-- Delete a location; items still in stock there are first moved to p_move_to.
-- (Direct deletes are not granted, so items can never lose their location by accident.)
create or replace function public.delete_storage_location(p_location_id uuid, p_move_to uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  hid uuid;
begin
  select household_id into hid from public.storage_locations where id = p_location_id;
  if hid is null or not public.is_member(hid) then raise exception 'not_found'; end if;
  if (select count(*) from public.storage_locations where household_id = hid) <= 1 then
    raise exception 'last_location';
  end if;
  if exists (select 1 from public.items where location_id = p_location_id and status = 'in_fridge') then
    if p_move_to is null or p_move_to = p_location_id or not exists (
      select 1 from public.storage_locations where id = p_move_to and household_id = hid
    ) then
      raise exception 'invalid_target';
    end if;
    -- Same kind or not: dates stay as they are (the app offers "move" with recalculation per item).
    update public.items set location_id = p_move_to
    where location_id = p_location_id and status = 'in_fridge';
  end if;
  delete from public.storage_locations where id = p_location_id;
end $$;

revoke all on function public.default_location(uuid), public.delete_storage_location(uuid, uuid)
  from public, anon;
-- default_location runs inside the items trigger as the signed-in user.
grant execute on function public.default_location(uuid), public.delete_storage_location(uuid, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges + RLS
-- ---------------------------------------------------------------------------

alter table public.storage_locations enable row level security;
revoke all on public.storage_locations from anon, authenticated;
grant select, insert on public.storage_locations to authenticated;
grant update (name, kind) on public.storage_locations to authenticated;

create policy locations_select on public.storage_locations for select to authenticated
  using (public.is_member(household_id));
create policy locations_insert on public.storage_locations for insert to authenticated
  with check (public.is_member(household_id));
create policy locations_update on public.storage_locations for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

grant update (location_id, stored_at) on public.items to authenticated;
grant update (shelf_defaults) on public.household_settings to authenticated;

-- Live updates when a housemate adds / renames a location.
alter publication supabase_realtime add table public.storage_locations;

commit;
