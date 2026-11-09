-- Athletics clubs (#339): imported each month from the State's company register, or typed by a
-- player (then "to validate"). Players find theirs by typing a few letters.

create table clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  city text not null default '',
  department text not null default '',
  siren text unique check (siren ~ '^[0-9]{9}$'),
  source text not null check (source in ('import', 'player')),
  validated boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  search_key text not null default '',
  created_at timestamptz not null default now()
);

-- Same key as searchKey() in src/domain/club.ts: no accents, lower case, single spaces.
create function club_search_key(p_text text) returns text
language sql stable set search_path = public, extensions as $$
  select trim(regexp_replace(lower(extensions.unaccent(p_text)), '[^a-z0-9]+', ' ', 'g'))
$$;

create function set_club_search_key() returns trigger
language plpgsql set search_path = public as $$
begin
  new.search_key := club_search_key(new.name || ' ' || new.city);
  return new;
end $$;

create trigger clubs_search_key
before insert or update of name, city on clubs
for each row execute function set_club_search_key();

alter table clubs enable row level security;

-- Validated clubs are public; a player also sees the club they typed.
create policy clubs_read on clubs for select to anon, authenticated
  using (validated or created_by = auth.uid());

-- Every word of the query must be found in the name or the town.
create function search_clubs(p_query text, p_limit int default 20)
returns table (id uuid, name text, city text, department text, validated boolean)
language sql stable security invoker set search_path = public as $$
  with q as (
    select array_remove(string_to_array(club_search_key(coalesce(p_query, '')), ' '), '') as words
  )
  select c.id, c.name, c.city, c.department, c.validated
  from clubs c, q
  where cardinality(q.words) > 0
    and not exists (select 1 from unnest(q.words) w where position(w in c.search_key) = 0)
  order by (c.search_key like q.words[1] || '%') desc, c.name
  limit least(greatest(p_limit, 1), 50)
$$;

grant execute on function search_clubs(text, int) to anon, authenticated;

-- Monthly import (scripts/clubs/import.ts): one row per SIREN, validated, names refreshed.
-- Run by the database owner only (workflow "Clubs import"), never by the app.
create function import_clubs(p_clubs jsonb) returns int
language plpgsql set search_path = public as $$
declare
  v_count int;
begin
  insert into clubs (name, city, department, siren, source, validated)
  select c->>'name', coalesce(c->>'city', ''), coalesce(c->>'department', ''), c->>'siren', 'import', true
  from jsonb_array_elements(p_clubs) c
  on conflict (siren) do update
    set name = excluded.name, city = excluded.city, department = excluded.department;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function import_clubs(jsonb) from public, anon, authenticated;
