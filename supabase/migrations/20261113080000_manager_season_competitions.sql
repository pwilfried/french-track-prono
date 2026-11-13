-- French Track Manager (#644): the number of players comes from the competitions chosen at the
-- creation, no longer from a choice of the creator (#619).
--   The championship is a home-and-away: with N players, 2 × (N − 1) matchdays, one competition
--   each. The creator chooses at least 6 competitions among the eligible ones (manager_competitions)
--   that are not finished; player_target = the largest even N from 4 to 10 whose home-and-away
--   fits. The competitions left over, at the end, are bonus matchdays.
--   The creator adds or removes competitions while the mercato has not opened: the target is
--   derived again, never under the players already in.
--   A competition counts only if the mercato ends at least 1 hour before its first event. Before
--   opening, the end is planned: 3 rounds of the league (PLANNED_ROUNDS). The creator cannot
--   launch, and the job does not open, a mercato that would leave fewer competitions than the
--   home-and-away needs.
-- The same rules are in src/domain/manager-league.ts.
-- Error codes: 42501 not signed in or not the creator, FT015 mercato already open, FT027
-- competitions refused (fewer than 6, not available, or fewer players than already in), FT026
-- players still missing, FT028 not enough competitions after the planned end of the mercato.

-- The players of `p_competitions` competitions, or null under 6.
create function private.manager_player_count(p_competitions int) returns int
language sql immutable set search_path = public as $$
  select case when p_competitions < 6 then null
              else least(10, (p_competitions / 2 + 1) / 2 * 2) end
$$;
revoke execute on function private.manager_player_count(int) from public, anon, authenticated;

-- When the first event of a competition starts: its first event, else the day it starts (Paris).
create function private.manager_first_event(p_competition uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select min(e.starts_at) from events e where e.competition_id = p_competition),
    (select c.starts_on::timestamp at time zone 'Europe/Paris'
     from competitions c where c.id = p_competition))
$$;
revoke execute on function private.manager_first_event(uuid) from public, anon, authenticated;

-- The competitions a league can be created with: eligible and not finished, first one first.
create function list_manager_available_competitions()
returns table (competition_id uuid, name text, first_event_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, private.manager_first_event(c.id)
  from manager_competitions mc
  join competitions c on c.id = mc.competition_id
  where c.status <> 'finished'
  order by 3, c.name
$$;
revoke execute on function list_manager_available_competitions() from public, anon;
grant execute on function list_manager_available_competitions() to authenticated;

-- The competitions of a league, first one first, for its participants only.
create function list_manager_league_competitions(p_league uuid)
returns table (competition_id uuid, name text, first_event_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, private.manager_first_event(c.id)
  from manager_leagues l
  cross join lateral unnest(l.competition_ids) as e(id)
  join competitions c on c.id = e.id
  where l.id = p_league and is_manager_member(l.id)
  order by 3, c.name
$$;
revoke execute on function list_manager_league_competitions(uuid) from public, anon;
grant execute on function list_manager_league_competitions(uuid) to authenticated;

-- The competitions chosen, first one first, once each: all available, at least 6 (else FT027).
create function private.manager_chosen_competitions(p_competitions uuid[]) returns uuid[]
language plpgsql stable security definer set search_path = public as $$
declare
  v_wanted int := coalesce((select count(distinct id) from unnest(p_competitions) id), 0);
  v_chosen uuid[];
begin
  select array_agg(competition_id order by first_event_at, name) into v_chosen
  from list_manager_available_competitions()
  where competition_id = any(p_competitions);
  if v_wanted < 6 or coalesce(array_length(v_chosen, 1), 0) <> v_wanted then
    raise exception 'competitions refused' using errcode = 'FT027';
  end if;
  return v_chosen;
end $$;
revoke execute on function private.manager_chosen_competitions(uuid[])
  from public, anon, authenticated;

-- As in #419, on the competitions the creator chooses: the target follows.
drop function create_manager_league(text, boolean);
create function create_manager_league(p_name text, p_public boolean, p_competitions uuid[])
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_competitions uuid[];
  v_league uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if is_banned_league_name(v_name) then
    raise exception 'banned name' using errcode = 'FT010';
  end if;
  v_competitions := private.manager_chosen_competitions(p_competitions);
  insert into manager_leagues (name, is_public, owner_id, rules, competition_ids, player_target)
  values (v_name, coalesce(p_public, false), auth.uid(), (select rules from manager_rules),
          v_competitions, private.manager_player_count(array_length(v_competitions, 1)))
  returning id into v_league;
  insert into manager_members (league_id, user_id) values (v_league, auth.uid());
  return v_league;
end $$;
revoke execute on function create_manager_league(text, boolean, uuid[]) from public, anon;
grant execute on function create_manager_league(text, boolean, uuid[]) to authenticated;

-- The creator adds or removes competitions while the mercato is not open: the target follows,
-- never under the players already in.
create function set_manager_competitions(p_league uuid, p_competitions uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_competitions uuid[];
  v_target int;
begin
  perform private.lock_manager_creator(p_league);
  v_competitions := private.manager_chosen_competitions(p_competitions);
  v_target := private.manager_player_count(array_length(v_competitions, 1));
  if v_target < (select count(*) from manager_members where league_id = p_league) then
    raise exception 'fewer players than already in' using errcode = 'FT027';
  end if;
  update manager_leagues set competition_ids = v_competitions, player_target = v_target
  where id = p_league;
end $$;
revoke execute on function set_manager_competitions(uuid, uuid[]) from public, anon;
grant execute on function set_manager_competitions(uuid, uuid[]) to authenticated;

-- As in #619, without the target: it comes from the competitions.
drop function set_manager_mercato(uuid, int, timestamptz, text, int, int);
create function set_manager_mercato(
  p_league uuid, p_starts_at timestamptz, p_mode text,
  p_first_hours int default null, p_next_hours int default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform private.lock_manager_creator(p_league);
  if p_mode is null or p_mode not in ('auto', 'custom')
     or (p_mode = 'custom' and (p_first_hours is null or p_first_hours not in (12, 24, 48, 72)
                                or p_next_hours is null or p_next_hours not in (12, 24, 48, 72)))
  then
    raise exception 'rounds refused' using errcode = '22023';
  end if;
  update manager_leagues
  set mercato_starts_at = p_starts_at,
      round_mode = p_mode,
      rules = jsonb_set(rules, '{rounds}',
        case when p_mode = 'auto' then (select r.rules -> 'rounds' from manager_rules r)
             else jsonb_build_object('firstHours', p_first_hours, 'longRounds', 1,
                                     'nextHours', p_next_hours) end)
  where id = p_league;
end $$;
revoke execute on function set_manager_mercato(uuid, timestamptz, text, int, int) from public, anon;
grant execute on function set_manager_mercato(uuid, timestamptz, text, int, int) to authenticated;

-- Whether a mercato opening at `p_at` leaves the league enough competitions: those whose first
-- event is at least 1 hour after the end of its 3 planned rounds hold its home-and-away.
create function private.manager_season_fits(p_league uuid, p_at timestamptz) returns boolean
language sql stable security definer set search_path = public as $$
  with l as (select * from manager_leagues where id = p_league),
  r as (
    select l.*, p_at + make_interval(hours => (
      select sum(case when n <= (l.rules -> 'rounds' ->> 'longRounds')::int
                      then (l.rules -> 'rounds' ->> 'firstHours')::int
                      else (l.rules -> 'rounds' ->> 'nextHours')::int end)::int
      from generate_series(1, 3) n)) as mercato_ends_at
    from l
  )
  select (select count(*) from unnest(r.competition_ids) as e(id)
          where private.manager_first_event(e.id) >= r.mercato_ends_at + interval '1 hour')
         >= 2 * (r.player_target - 1)
  from r
$$;
revoke execute on function private.manager_season_fits(uuid, timestamptz)
  from public, anon, authenticated;

-- As in #619, and only if enough competitions start after the planned end of the mercato.
create or replace function launch_manager_mercato(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_league manager_leagues;
begin
  v_league := private.lock_manager_creator(p_league);
  if (select count(*) from manager_members where league_id = p_league) <> v_league.player_target
  then
    raise exception 'players missing' using errcode = 'FT026';
  end if;
  if not private.manager_season_fits(p_league, now()) then
    raise exception 'not enough competitions after the mercato' using errcode = 'FT028';
  end if;
  update manager_leagues set mercato_opened_at = now() where id = p_league;
end $$;

-- As in #619: at its time, the mercato opens if the target is reached and enough competitions
-- start after its planned end; otherwise it waits.
create or replace function private.open_manager_mercatos() returns int
language plpgsql security definer set search_path = public as $$
declare v_opened int;
begin
  update manager_leagues l
  set mercato_opened_at = now()
  where l.mercato_opened_at is null and l.mercato_starts_at <= now()
    and (select count(*) from manager_members m where m.league_id = l.id) = l.player_target
    and private.manager_season_fits(l.id, now());
  get diagnostics v_opened = row_count;
  return v_opened;
end $$;
