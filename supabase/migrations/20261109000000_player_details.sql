-- Sign-up asks sex, disciplines and club, all optional (#340, docs/decisions/profils.md).
-- The club is public (minimal player card); sex and disciplines stay private to the player.

alter table profiles add column club_id uuid references clubs (id) on delete set null;

create table player_details (
  profile_id uuid primary key references profiles (id) on delete cascade,
  sex text check (sex in ('F', 'M')),
  disciplines text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table player_details enable row level security;
create policy own_read on player_details for select to authenticated using (profile_id = auth.uid());
create policy own_insert on player_details for insert to authenticated with check (profile_id = auth.uid());
create policy own_update on player_details for update to authenticated using (profile_id = auth.uid());

-- Only disciplines of the `disciplines` table, each once.
create function check_player_disciplines() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from unnest(new.disciplines) d where d not in (select name from disciplines)) then
    raise exception 'unknown discipline' using errcode = '23503';
  end if;
  new.disciplines := array(select distinct unnest(new.disciplines));
  new.updated_at := now();
  return new;
end $$;

create trigger player_details_disciplines
before insert or update on player_details
for each row execute function check_player_disciplines();

-- A player's club must be one they can see: validated, or the one they typed.
create function check_profile_club() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.club_id is not null and not exists (
    select 1 from clubs c where c.id = new.club_id and (c.validated or c.created_by = new.id)
  ) then
    raise exception 'unknown club' using errcode = 'P0002';
  end if;
  return new;
end $$;

create trigger profiles_club
before insert or update of club_id on profiles
for each row execute function check_profile_club();

-- A club missing from the list, typed by the player: saved "to validate" by the admin.
-- The same name (accents and case ignored) gives back the club already there.
create function propose_club(p_name text, p_city text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_city text := regexp_replace(trim(coalesce(p_city, '')), '\s+', ' ', 'g');
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if length(v_name) not between 2 and 120 or length(v_city) > 80 then
    raise exception 'invalid club name' using errcode = '22023';
  end if;
  if is_banned_name(v_name) or is_banned_name(v_city) then
    raise exception 'banned name' using errcode = 'FT013';
  end if;
  select c.id into v_id from clubs c
  where c.search_key = club_search_key(v_name || ' ' || v_city)
    and (c.validated or c.created_by = auth.uid())
  order by c.validated desc
  limit 1;
  if v_id is null then
    insert into clubs (name, city, source, created_by)
    values (v_name, v_city, 'player', auth.uid())
    returning id into v_id;
  end if;
  return v_id;
end $$;

revoke execute on function propose_club(text, text) from public, anon;
grant execute on function propose_club(text, text) to authenticated;
