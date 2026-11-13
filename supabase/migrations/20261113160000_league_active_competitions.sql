-- v0.17 (#614): a league, private or public, is created with at least one active competition
-- (still to come or under way, decision of the owner, 12 Nov 2026); a competition added later
-- follows the same rule. A finished competition never joins a league.
-- Each competition remembers when it entered the league: only the events locked after count in
-- the league ranking (computed in TypeScript, src/domain/league.ts countsSinceEntry). They still
-- count in the general ranking and in the other leagues.
-- The day is read in Paris time, the time of the app (#501).
-- Error codes: 42501 not signed in or not the creator, P0002 unknown competition, FT009 finished
-- competition (it was « already started » before #614), FT030 no competition, FT010 banned name.

-- Null: counted from the start, every event counts (the leagues before #614, the official league).
alter table league_competitions add column added_at timestamptz;

-- True when a competition can join a league today: not finished, Paris time.
create function private.is_open_to_leagues(p_ends_on date)
returns boolean language sql stable set search_path = public as $$
  select p_ends_on >= (now() at time zone 'Europe/Paris')::date
$$;
revoke execute on function private.is_open_to_leagues(date) from public, anon, authenticated;

create or replace function create_league(p_name text, p_competition_slugs text[],
                                         p_public boolean default false,
                                         p_families text[] default '{}')
returns table (league_id uuid, invite_code text)
language plpgsql security definer set search_path = public as $$
declare
  v_league uuid;
  v_code text;
  v_wanted int := coalesce((select count(distinct s) from unnest(p_competition_slugs) s), 0);
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if p_public and is_banned_league_name(p_name) then
    raise exception 'banned name' using errcode = 'FT010';
  end if;
  if v_wanted = 0 then
    raise exception 'a league needs a competition' using errcode = 'FT030';
  end if;
  if (select count(*) from competitions where slug = any(p_competition_slugs)) <> v_wanted then
    raise exception 'unknown competition' using errcode = 'P0002';
  end if;
  if exists (select 1 from competitions
             where slug = any(p_competition_slugs) and not private.is_open_to_leagues(ends_on)) then
    raise exception 'competition finished' using errcode = 'FT009';
  end if;
  insert into leagues (name, owner_id, is_public) values (trim(p_name), auth.uid(), p_public)
  returning id, leagues.invite_code into v_league, v_code;
  insert into league_members (league_id, user_id, role) values (v_league, auth.uid(), 'owner');
  insert into league_competitions (league_id, competition_id, added_at)
  select v_league, c.id, now() from competitions c where c.slug = any(p_competition_slugs);
  insert into league_families (league_id, family)
  select distinct v_league, f from unnest(coalesce(p_families, '{}')) f;
  return query select v_league, v_code;
end $$;

-- Adding a competition twice keeps its first date.
create or replace function add_league_competition(p_league uuid, p_competition_slug text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_competition uuid;
  v_ends date;
begin
  if auth.uid() is null
     or not exists (select 1 from leagues where id = p_league and owner_id = auth.uid()) then
    raise exception 'only the creator adds a competition' using errcode = '42501';
  end if;
  select id, ends_on into v_competition, v_ends from competitions where slug = p_competition_slug;
  if v_competition is null then
    raise exception 'unknown competition' using errcode = 'P0002';
  end if;
  if not private.is_open_to_leagues(v_ends) then
    raise exception 'competition finished' using errcode = 'FT009';
  end if;
  insert into league_competitions (league_id, competition_id, added_at)
  values (p_league, v_competition, now())
  on conflict do nothing;
end $$;
