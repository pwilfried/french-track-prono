-- French Track Manager, v0.16 (#432): the home-and-away schedule of the season. Each participant
-- meets every other one twice, once at home and once away, over 2 × (n − 1) matchdays. The
-- schedule is drawn when the season starts, that is when the mercato of the league closes
-- (mercato_closed_at, #424), and never changes: drawn once, no write for the players.
-- One eligible competition = one matchday (owner's answer, #440): the competitions of the league,
-- first one first (starts_on, then name), go to matchdays 1, 2, 3… A competition beyond the last
-- matchday has no head-to-head; a matchday beyond the last competition has none (competition_id
-- null) and is not played. The same rules are in src/domain/manager-schedule.ts.
-- The players are drawn in a random order (random(): setseed() makes it reproducible in pgTAP),
-- then placed as in seasonSchedule().

create table manager_fixtures (
  league_id      uuid not null references manager_leagues(id) on delete cascade,
  round          int not null check (round >= 1),
  competition_id uuid references competitions(id) on delete set null,
  home_id        uuid not null references profiles(id) on delete cascade,
  away_id        uuid not null references profiles(id) on delete cascade,
  primary key (league_id, round, home_id),
  unique (league_id, round, away_id),
  check (home_id <> away_id)
);
create index on manager_fixtures (league_id, competition_id);

alter table manager_fixtures enable row level security;
create policy read_member on manager_fixtures for select to authenticated
  using (is_manager_member(league_id));
revoke insert, update, delete, truncate on manager_fixtures from anon, authenticated;

-- Draws the schedule of a league, once: a league that has one keeps it. Nothing with an odd
-- number of participants. Returns how many head-to-heads it wrote.
create function private.schedule_manager_season(p_league uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_players uuid[];
  v_competitions uuid[];
  v_n int;
  v_m int;
  v_r int;
  v_k int;
  v_back int;
  v_a uuid;
  v_b uuid;
begin
  perform 1 from manager_leagues where id = p_league for update;
  if exists (select 1 from manager_fixtures where league_id = p_league) then
    return 0;
  end if;
  select array_agg(user_id order by random()) into v_players
  from manager_members where league_id = p_league;
  v_n := coalesce(array_length(v_players, 1), 0);
  if v_n < 2 or v_n % 2 <> 0 then
    return 0;
  end if;
  select array_agg(c.id order by c.starts_on, c.name, c.id) into v_competitions
  from manager_leagues l
  cross join lateral unnest(l.competition_ids) as e(id)
  join competitions c on c.id = e.id
  where l.id = p_league;
  v_m := v_n - 1;
  for v_r in 0 .. v_m - 1 loop
    -- The return leg starts from the second matchday of the first leg; the first comes last.
    v_back := v_m + (v_r + v_m - 1) % v_m + 1;
    -- The last player, fixed, meets player r.
    if v_r % 2 = 0 then
      v_a := v_players[v_r + 1];
      v_b := v_players[v_m + 1];
    else
      v_a := v_players[v_m + 1];
      v_b := v_players[v_r + 1];
    end if;
    insert into manager_fixtures (league_id, round, competition_id, home_id, away_id) values
      (p_league, v_r + 1, v_competitions[v_r + 1], v_a, v_b),
      (p_league, v_back, v_competitions[v_back], v_b, v_a);
    -- The k-th other pair: players r + k and r − k, home and away alternating with k.
    for v_k in 1 .. v_n / 2 - 1 loop
      if v_k % 2 = 1 then
        v_a := v_players[(v_r + v_k) % v_m + 1];
        v_b := v_players[(v_r - v_k + v_m) % v_m + 1];
      else
        v_a := v_players[(v_r - v_k + v_m) % v_m + 1];
        v_b := v_players[(v_r + v_k) % v_m + 1];
      end if;
      insert into manager_fixtures (league_id, round, competition_id, home_id, away_id) values
        (p_league, v_r + 1, v_competitions[v_r + 1], v_a, v_b),
        (p_league, v_back, v_competitions[v_back], v_b, v_a);
    end loop;
  end loop;
  return v_n * v_m;
end $$;
revoke execute on function private.schedule_manager_season(uuid) from public, anon, authenticated;

-- The season starts when the mercato closes, whichever way it closes.
create function private.schedule_on_mercato_close() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform private.schedule_manager_season(new.id);
  return null;
end $$;
revoke execute on function private.schedule_on_mercato_close() from public, anon, authenticated;

create trigger schedule_season
  after update of mercato_closed_at on manager_leagues
  for each row
  when (old.mercato_closed_at is null and new.mercato_closed_at is not null)
  execute function private.schedule_on_mercato_close();

-- The leagues whose season has already started get their schedule now.
select private.schedule_manager_season(id) from manager_leagues where mercato_closed_at is not null;
