-- French Track Manager, v0.16 (#434): the end of the season and its honours. Owner's rule
-- (13 Nov. 2026): the season ends after the last matchday of the schedule, bonus matchdays
-- included, that is once every matchday that has a competition has Manager scores (a matchday
-- without competition is not played). No playoffs: the first of the standings is champion, and
-- the final standings and the honours are frozen once, in manager_honours. Scores computed again
-- afterwards (#416) do not change them.
-- The standings follow src/domain/manager-championship.ts (win 3, draw 1, defeat 0; then wins,
-- Manager points difference, Manager points scored; a missing score counts 0; bonus matchdays
-- give no championship point). On a full tie the rank is shared and the earliest participant to
-- join comes first, as in the app: the champion is the first line. The end of the season follows
-- seasonOver() in src/domain/manager-honours.ts.

create table manager_honours (
  league_id   uuid primary key references manager_leagues(id) on delete cascade,
  champion_id uuid references profiles(id) on delete set null,
  ended_at    timestamptz not null default now(),
  -- [{user_id, rank, played, wins, draws, losses, scored, conceded, difference, points}], first first.
  standings   jsonb not null check (jsonb_typeof(standings) = 'array'),
  -- [{round, home_id, away_id, home_score, away_score}]: every head-to-head of the season.
  duels       jsonb not null check (jsonb_typeof(duels) = 'array'),
  -- [{user_id, manager_points, best_athlete: {athlete_id, name, points} | null}]: every matchday,
  -- bonus ones included.
  players     jsonb not null check (jsonb_typeof(players) = 'array')
);

alter table manager_honours enable row level security;
create policy read_member on manager_honours for select to authenticated
  using (is_manager_member(league_id));
revoke insert, update, delete, truncate on manager_honours from anon, authenticated;

-- Closes the season of a league when every matchday of its schedule is scored, once. Returns
-- whether it closed it now.
create function private.close_manager_season(p_league uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from manager_honours where league_id = p_league)
     or not exists (select 1 from manager_matchdays
                    where league_id = p_league and competition_id is not null)
     or exists (select 1 from manager_matchdays m
                where m.league_id = p_league and m.competition_id is not null
                  and not exists (select 1 from manager_scores s
                                  where s.league_id = p_league
                                    and s.competition_id = m.competition_id)) then
    return false;
  end if;

  with duels as (
    select f.round, f.home_id, f.away_id,
           coalesce(h.total, 0) as home_score, coalesce(a.total, 0) as away_score
    from manager_fixtures f
    join manager_matchdays m on m.league_id = f.league_id and m.round = f.round
    left join manager_scores h
      on h.league_id = f.league_id and h.competition_id = m.competition_id and h.user_id = f.home_id
    left join manager_scores a
      on a.league_id = f.league_id and a.competition_id = m.competition_id and a.user_id = f.away_id
    where f.league_id = p_league and not m.bonus and m.competition_id is not null
  ),
  sides as (
    select home_id as user_id, home_score as scored, away_score as conceded from duels
    union all
    select away_id, away_score, home_score from duels
  ),
  totals as (
    select mm.user_id, mm.joined_at,
           count(s.user_id)::int as played,
           count(*) filter (where s.scored > s.conceded)::int as wins,
           count(*) filter (where s.scored = s.conceded)::int as draws,
           count(*) filter (where s.scored < s.conceded)::int as losses,
           coalesce(sum(s.scored), 0)::int as scored,
           coalesce(sum(s.conceded), 0)::int as conceded
    from manager_members mm
    left join sides s on s.user_id = mm.user_id
    where mm.league_id = p_league
    group by mm.user_id, mm.joined_at
  ),
  ranked as (
    select t.*, t.scored - t.conceded as difference, 3 * t.wins + t.draws as points,
           rank() over w as rank,
           row_number() over (w_tie) as position
    from totals t
    window w as (order by 3 * t.wins + t.draws desc, t.wins desc, t.scored - t.conceded desc,
                          t.scored desc),
           w_tie as (order by 3 * t.wins + t.draws desc, t.wins desc,
                              t.scored - t.conceded desc, t.scored desc, t.joined_at, t.user_id)
  ),
  athlete_points as (
    select s.user_id, (x ->> 'athlete_id')::uuid as athlete_id,
           sum((x ->> 'total')::int)::int as points
    from manager_scores s
    cross join lateral jsonb_array_elements(s.athletes) as x
    where s.league_id = p_league
    group by 1, 2
  ),
  best as (
    select distinct on (p.user_id) p.user_id, p.athlete_id, coalesce(a.name, '?') as name, p.points
    from athlete_points p
    left join athletes a on a.id = p.athlete_id
    order by p.user_id, p.points desc, a.name, p.athlete_id
  ),
  manager_points as (
    select user_id, sum(total)::int as points from manager_scores
    where league_id = p_league group by user_id
  )
  insert into manager_honours (league_id, champion_id, standings, duels, players)
  select p_league,
         (select user_id from ranked where position = 1),
         (select jsonb_agg(jsonb_build_object(
                   'user_id', user_id, 'rank', rank, 'played', played, 'wins', wins,
                   'draws', draws, 'losses', losses, 'scored', scored, 'conceded', conceded,
                   'difference', difference, 'points', points) order by position)
          from ranked),
         coalesce((select jsonb_agg(jsonb_build_object(
                             'round', round, 'home_id', home_id, 'away_id', away_id,
                             'home_score', home_score, 'away_score', away_score)
                           order by round, home_id)
                   from duels), '[]'::jsonb),
         (select jsonb_agg(jsonb_build_object(
                   'user_id', mm.user_id, 'manager_points', coalesce(mp.points, 0),
                   'best_athlete', case when b.user_id is null then null
                                   else jsonb_build_object('athlete_id', b.athlete_id,
                                                           'name', b.name, 'points', b.points)
                                   end)
                 order by mm.joined_at, mm.user_id)
          from manager_members mm
          left join manager_points mp on mp.user_id = mm.user_id
          left join best b on b.user_id = mm.user_id
          where mm.league_id = p_league)
  on conflict (league_id) do nothing;
  return found;
end $$;
revoke execute on function private.close_manager_season(uuid) from public, anon, authenticated;

-- Each new batch of Manager scores may finish the season of its leagues.
create function private.close_seasons_on_scores() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform private.close_manager_season(l.league_id)
  from (select distinct league_id from added) l;
  return null;
end $$;
revoke execute on function private.close_seasons_on_scores() from public, anon, authenticated;

create trigger close_seasons
  after insert on manager_scores
  referencing new table as added
  for each statement
  execute function private.close_seasons_on_scores();

-- The leagues whose season is already over get their honours now.
select private.close_manager_season(id) from manager_leagues where mercato_closed_at is not null;
