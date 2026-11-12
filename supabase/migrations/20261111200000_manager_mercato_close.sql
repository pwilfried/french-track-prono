-- French Track Manager, v0.13 (#424): closing the mercato, in the ways the rules of the league
-- allow (`closeModes`, copied at creation):
--   budgets_spent  no participant can recruit any more: the job closes it;
--   last_bidder    the last participant who can still recruit decides to close it
--                  (close_manager_mercato);
--   scheduled      at mercato_closes_at: the job closes it.
-- A participant can recruit while their team has room (`teamSize`) and their credits left pay the
-- cheapest athlete still free in the league. The close is collective: every participant's row is
-- locked and read; the bids under way are resolved first, as a last round (same rule as
-- awardBids). Then the league keeps mercato_closed_at and takes no more bids. The same rules are
-- in src/domain/manager-mercato.ts.
-- Error codes, added to those of #422 and #423: FT016 also once the mercato is closed, FT020 also
-- once the scheduled time is over (bids wait for the job), FT021 not the last participant who can
-- recruit (or the rules do not let them close).

alter table manager_leagues
  add column mercato_closes_at timestamptz,
  add column mercato_closed_at timestamptz;

-- True when the rules of the league allow this way of closing the mercato.
create function private.manager_close_allowed(p_league uuid, p_mode text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select rules -> 'closeModes' ? p_mode from manager_leagues where id = p_league),
                  false)
$$;
revoke execute on function private.manager_close_allowed(uuid, text) from public, anon, authenticated;

-- The participants who can still recruit: room in the team (no limit without `teamSize`) and
-- credits left for the cheapest athlete of the catalogue still free in the league. The bids under
-- way do not count: they are resolved before any close.
create function private.manager_recruiters(p_league uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  with league as (
    select (rules ->> 'budget')::numeric::int as budget, (rules ->> 'teamSize')::int as team_size
    from manager_leagues where id = p_league
  ), cheapest as (
    select min(a.manager_price) as price
    from athletes a
    join athlete_disciplines ad on ad.athlete_id = a.id and ad.is_primary
    join disciplines d on d.name = ad.discipline
    where a.manager_price is not null and a.kind = 'athlete' and a.gender in ('F', 'M')
      and d.family <> 'relay'
      and not exists (select 1 from manager_awards w
                      where w.league_id = p_league and w.athlete_id = a.id)
  )
  select m.user_id
  from manager_members m, league l, cheapest c
  where m.league_id = p_league
    and l.budget - private.manager_spent(p_league, m.user_id) >= c.price
    and (l.team_size is null
         or (select count(*) from manager_awards w
             where w.league_id = p_league and w.user_id = m.user_id) < l.team_size)
$$;
revoke execute on function private.manager_recruiters(uuid) from public, anon, authenticated;

-- As in #423; no round is open once the mercato is closed.
create or replace function private.manager_open_round(p_league uuid)
returns table (round int, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.n,
         l.mercato_opened_at + make_interval(hours =>
           case when c.n <= h.long then c.n * h.first
                else h.long * h.first + (c.n - h.long) * h.next end)
  from manager_leagues l
  cross join lateral (select coalesce(max(r.round), 0) + 1 as n
                      from manager_rounds r where r.league_id = l.id) c
  cross join lateral (select (l.rules -> 'rounds' ->> 'firstHours')::int as first,
                             (l.rules -> 'rounds' ->> 'longRounds')::int as long,
                             (l.rules -> 'rounds' ->> 'nextHours')::int as next) h
  where l.id = p_league and l.mercato_opened_at is not null and l.mercato_closed_at is null
$$;

-- As in #423; no bid once the mercato is closed (FT016), nor once its scheduled time is over,
-- until the job has closed it (FT020).
create or replace function private.lock_manager_bidder(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_league manager_leagues;
begin
  perform 1 from manager_members
  where league_id = p_league and user_id = auth.uid() for update;
  if not found then
    raise exception 'only a participant bids' using errcode = '42501';
  end if;
  select * into v_league from manager_leagues where id = p_league;
  if v_league.mercato_opened_at is null or v_league.mercato_opened_at > now()
     or v_league.mercato_closed_at is not null then
    raise exception 'mercato not open' using errcode = 'FT016';
  end if;
  if (select ends_at <= now() from private.manager_open_round(p_league))
     or (v_league.mercato_closes_at <= now()
         and private.manager_close_allowed(p_league, 'scheduled')) then
    raise exception 'round closing' using errcode = 'FT020';
  end if;
end $$;

-- Closes round p_round of a league, ending at p_ends: the highest bid on each athlete wins, a tie
-- goes to the bid placed first at that amount; every bid of the league is then deleted (the
-- winning ones became awards, the losing ones are freed). The caller locks the participants.
create function private.award_manager_round(p_league uuid, p_round int, p_ends timestamptz)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into manager_rounds (league_id, round, ends_at) values (p_league, p_round, p_ends);
  insert into manager_awards (league_id, athlete_id, user_id, amount, round)
  select distinct on (b.athlete_id) b.league_id, b.athlete_id, b.user_id, b.amount, p_round
  from manager_bids b
  where b.league_id = p_league
    and not exists (select 1 from manager_awards w
                    where w.league_id = b.league_id and w.athlete_id = b.athlete_id)
  order by b.athlete_id, b.amount desc, b.bid_at, b.user_id;
  delete from manager_bids where league_id = p_league;
end $$;
revoke execute on function private.award_manager_round(uuid, int, timestamptz)
  from public, anon, authenticated;

-- Closes the rounds of a league whose time is over, in order; returns how many. The caller locks
-- the participants.
create function private.close_league_rounds(p_league uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_round int;
  v_ends timestamptz;
  v_closed int := 0;
begin
  loop
    select o.round, o.ends_at into v_round, v_ends from private.manager_open_round(p_league) o;
    exit when v_ends is null or v_ends > now();
    perform private.award_manager_round(p_league, v_round, v_ends);
    v_closed := v_closed + 1;
  end loop;
  return v_closed;
end $$;
revoke execute on function private.close_league_rounds(uuid) from public, anon, authenticated;

-- Ends the mercato of a league: the bids under way are resolved as a last round, then the league
-- is closed. The caller locks the participants.
create function private.finish_manager_mercato(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from manager_bids where league_id = p_league) then
    perform private.award_manager_round(p_league,
      (select round from private.manager_open_round(p_league)), now());
  end if;
  update manager_leagues set mercato_closed_at = now() where id = p_league;
end $$;
revoke execute on function private.finish_manager_mercato(uuid) from public, anon, authenticated;

-- As in #423, then closes the mercato of each league whose scheduled time is over, or in which no
-- participant can recruit any more, as its rules allow. Returns how many rounds it closed.
create or replace function private.close_manager_rounds() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_league manager_leagues;
  v_closed int := 0;
begin
  for v_league in
    select * from manager_leagues
    where mercato_opened_at <= now() and mercato_closed_at is null
    order by id
  loop
    perform 1 from manager_members where league_id = v_league.id order by user_id for update;
    v_closed := v_closed + private.close_league_rounds(v_league.id);
    if (v_league.mercato_closes_at <= now()
        and private.manager_close_allowed(v_league.id, 'scheduled'))
       or (private.manager_close_allowed(v_league.id, 'budgets_spent')
           and not exists (select 1 from private.manager_recruiters(v_league.id))) then
      perform private.finish_manager_mercato(v_league.id);
    end if;
  end loop;
  return v_closed;
end $$;

-- True when the caller is the only participant of the league who can still recruit, its mercato is
-- open and its rules let the last bidder close it.
create function can_close_manager_mercato(p_league uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    is_manager_member(p_league)
    and exists (select 1 from manager_leagues
                where id = p_league and mercato_opened_at <= now() and mercato_closed_at is null)
    and private.manager_close_allowed(p_league, 'last_bidder')
    and (select array_agg(r.user_id) from private.manager_recruiters(p_league) as r(user_id))
        = array[auth.uid()],
    false)
$$;
revoke execute on function can_close_manager_mercato(uuid) from public, anon;
grant execute on function can_close_manager_mercato(uuid) to authenticated;

-- The last participant who can still recruit closes the mercato. The rounds whose time is over
-- are closed first, then the situation of every participant is read.
create function close_manager_mercato(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_manager_member(p_league) then
    raise exception 'only a participant closes the mercato' using errcode = '42501';
  end if;
  perform 1 from manager_members where league_id = p_league order by user_id for update;
  if not exists (select 1 from manager_leagues
                 where id = p_league and mercato_opened_at <= now() and mercato_closed_at is null)
  then
    raise exception 'mercato not open' using errcode = 'FT016';
  end if;
  perform private.close_league_rounds(p_league);
  if not can_close_manager_mercato(p_league) then
    raise exception 'not the last bidder' using errcode = 'FT021';
  end if;
  perform private.finish_manager_mercato(p_league);
end $$;
revoke execute on function close_manager_mercato(uuid) from public, anon;
grant execute on function close_manager_mercato(uuid) to authenticated;
