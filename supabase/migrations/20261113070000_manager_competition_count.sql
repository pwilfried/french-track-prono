-- French Track Manager (#644, owner's decision of 13 Nov. 2026): the number of players comes from
-- the competitions. The season is home and away: with N players, 2 × (N − 1) matchdays, one
-- competition each.
--   create_manager_league  the creator picks the competitions open to the Manager and not over
--                          yet (6 at least); player_target is the largest even number from 4 to
--                          10 they hold. Competitions over that count are bonus matchdays.
--   set_manager_mercato    no target any more: it follows the competitions.
--   launch and opening     a competition counts only if it starts at least 1 h after the
--                          expected end of the mercato (as many rounds as `minTeamSize`, at the
--                          durations of the league). The mercato does not open while fewer
--                          competitions count than the home-and-away season needs.
-- The same rules are in src/domain/manager-league.ts.
-- Error codes: FT027 competitions refused (fewer than 6, not open to the Manager, or over),
-- FT028 too few competitions left once the mercato is over.

-- When a competition starts for the Manager: its first event, else its first day (Paris time).
create function private.manager_competition_start(p_competition uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select coalesce((select min(e.starts_at) from events e where e.competition_id = c.id),
                  c.starts_on::timestamp at time zone 'Europe/Paris')
  from competitions c where c.id = p_competition
$$;
revoke execute on function private.manager_competition_start(uuid)
  from public, anon, authenticated;

-- The players a home-and-away season holds on p_count competitions; null under 6.
create function private.manager_player_count(p_count int) returns int
language sql immutable set search_path = public as $$
  select case when p_count >= 6 then least(10, (p_count / 2 + 1) / 2 * 2) end
$$;
revoke execute on function private.manager_player_count(int) from public, anon, authenticated;

-- When a mercato opening at p_start is expected to be over: as many rounds as the smallest team
-- holds athletes (at least one), at the durations of the rules.
create function private.manager_mercato_end(p_rules jsonb, p_start timestamptz)
returns timestamptz
language sql immutable set search_path = public as $$
  select p_start + make_interval(hours =>
    least(r.n, r.long_rounds) * r.first_hours + greatest(0, r.n - r.long_rounds) * r.next_hours)
  from (select greatest(1, coalesce((p_rules ->> 'minTeamSize')::int, 1)) as n,
               (p_rules #>> '{rounds,longRounds}')::int as long_rounds,
               (p_rules #>> '{rounds,firstHours}')::int as first_hours,
               (p_rules #>> '{rounds,nextHours}')::int as next_hours) r
$$;
revoke execute on function private.manager_mercato_end(jsonb, timestamptz)
  from public, anon, authenticated;

-- How many competitions the home-and-away season of a league lacks, its mercato opening at
-- p_start: those starting less than 1 h after its expected end do not count.
create function private.manager_competitions_short(p_league uuid, p_start timestamptz)
returns int
language sql stable security definer set search_path = public as $$
  select greatest(0, 2 * (l.player_target - 1) - (
    select count(*)::int from unnest(l.competition_ids) as c(id)
    where private.manager_competition_start(c.id)
          >= private.manager_mercato_end(l.rules, p_start) + interval '1 hour'))
  from manager_leagues l where l.id = p_league
$$;
revoke execute on function private.manager_competitions_short(uuid, timestamptz)
  from public, anon, authenticated;

-- The competitions a new league may be played on: open to the Manager, not over, first first.
create function list_open_manager_competitions()
returns table (competition_id uuid, name text, starts_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, private.manager_competition_start(c.id)
  from manager_competitions mc join competitions c on c.id = mc.competition_id
  where c.status <> 'finished' and auth.uid() is not null
  order by 3, 2
$$;
revoke execute on function list_open_manager_competitions() from public, anon;
grant execute on function list_open_manager_competitions() to authenticated;

-- The competitions of a league, first first, for its participants.
create function manager_league_competitions(p_league uuid)
returns table (competition_id uuid, name text, starts_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, private.manager_competition_start(c.id)
  from manager_leagues l
  cross join unnest(l.competition_ids) as x(id)
  join competitions c on c.id = x.id
  where l.id = p_league and is_manager_member(p_league)
  order by 3, 2
$$;
revoke execute on function manager_league_competitions(uuid) from public, anon;
grant execute on function manager_league_competitions(uuid) to authenticated;

-- As in #419, with the competitions the creator picked: the target follows from them.
drop function create_manager_league(text, boolean);
create function create_manager_league(p_name text, p_public boolean, p_competitions uuid[])
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_ids uuid[] := (select coalesce(array_agg(distinct id), '{}')
                   from unnest(p_competitions) as c(id) where id is not null);
  v_league uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if is_banned_league_name(v_name) then
    raise exception 'banned name' using errcode = 'FT010';
  end if;
  if cardinality(v_ids) < 6 or exists (
    select 1 from unnest(v_ids) as c(id)
    where not exists (select 1 from manager_competitions mc
                      join competitions x on x.id = mc.competition_id
                      where mc.competition_id = c.id and x.status <> 'finished'))
  then
    raise exception 'competitions refused' using errcode = 'FT027';
  end if;
  insert into manager_leagues (name, is_public, owner_id, rules, competition_ids, player_target)
  values (v_name, coalesce(p_public, false), auth.uid(), (select rules from manager_rules),
          v_ids, private.manager_player_count(cardinality(v_ids)))
  returning id into v_league;
  insert into manager_members (league_id, user_id) values (v_league, auth.uid());
  return v_league;
end $$;
revoke execute on function create_manager_league(text, boolean, uuid[]) from public, anon;
grant execute on function create_manager_league(text, boolean, uuid[]) to authenticated;

-- As in #619, without the target: it follows the competitions.
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
revoke execute on function set_manager_mercato(uuid, timestamptz, text, int, int)
  from public, anon;
grant execute on function set_manager_mercato(uuid, timestamptz, text, int, int)
  to authenticated;

-- As in #619, and only while enough competitions are left for the season.
create or replace function launch_manager_mercato(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_league manager_leagues;
begin
  v_league := private.lock_manager_creator(p_league);
  if (select count(*) from manager_members where league_id = p_league) <> v_league.player_target
  then
    raise exception 'players missing' using errcode = 'FT026';
  end if;
  if private.manager_competitions_short(p_league, now()) > 0 then
    raise exception 'competitions short' using errcode = 'FT028';
  end if;
  update manager_leagues set mercato_opened_at = now() where id = p_league;
end $$;

-- As in #619, and only while enough competitions are left for the season; the others wait.
create or replace function private.open_manager_mercatos() returns int
language plpgsql security definer set search_path = public as $$
declare v_opened int;
begin
  update manager_leagues l
  set mercato_opened_at = now()
  where l.mercato_opened_at is null and l.mercato_starts_at <= now()
    and (select count(*) from manager_members m where m.league_id = l.id) = l.player_target
    and private.manager_competitions_short(l.id, now()) = 0;
  get diagnostics v_opened = row_count;
  return v_opened;
end $$;
