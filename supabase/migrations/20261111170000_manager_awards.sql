-- French Track Manager, v0.13 (#423): closing a bidding round and awarding the athletes.
-- Rounds follow each other from the opening of the mercato: the first `rounds.longRounds` last
-- `rounds.firstHours`, the next ones `rounds.nextHours` (rules of the league; 48 h, 48 h, then
-- 24 h). The « Manager rounds » workflow runs private.close_manager_rounds() every 5 minutes: for
-- each round due, the highest bid on each athlete wins; a tie goes to the bid placed first at that
-- amount (bid_at). The winning amount is spent, every other bid of the league is freed, and an
-- athlete belongs to one team of the league only (primary key). Running it again closes nothing
-- twice. The rule is the same as awardBids in src/domain/manager-round.ts.
-- Error codes, added to those of #422: FT019 athlete already won, FT020 round closing (its time
-- is over, the job has not closed it yet: bids wait a few minutes).

-- The rounds closed, one row each, in order.
create table manager_rounds (
  league_id uuid not null references manager_leagues(id) on delete cascade,
  round     int not null check (round > 0),
  ends_at   timestamptz not null,
  closed_at timestamptz not null default now(),
  primary key (league_id, round)
);

-- The athletes won. One team per athlete in a league.
create table manager_awards (
  league_id  uuid not null,
  athlete_id uuid not null references athletes(id) on delete cascade,
  user_id    uuid not null,
  amount     int not null check (amount > 0),
  round      int not null,
  primary key (league_id, athlete_id),
  foreign key (league_id, user_id) references manager_members (league_id, user_id) on delete cascade,
  foreign key (league_id, round) references manager_rounds (league_id, round) on delete cascade
);
create index on manager_awards (league_id, user_id);

alter table manager_rounds enable row level security;
alter table manager_awards enable row level security;
create policy read_member on manager_rounds for select to authenticated
  using (is_manager_member(league_id));
-- What the others paid stays secret: a player reads their own athletes; the catalogue shows which
-- athletes are taken.
create policy read_own on manager_awards for select to authenticated
  using (user_id = auth.uid());
revoke insert, update, delete, truncate on manager_rounds, manager_awards from anon, authenticated;

-- The round open for bids in a league (the first one not closed) and when it ends; no row before
-- the mercato opens, a null end when the rules have no rounds.
create function private.manager_open_round(p_league uuid)
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
  where l.id = p_league and l.mercato_opened_at is not null
$$;
revoke execute on function private.manager_open_round(uuid) from public, anon, authenticated;

-- What a participant has spent on the athletes they won.
create function private.manager_spent(p_league uuid, p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0)::int from manager_awards
  where league_id = p_league and user_id = p_user
$$;
revoke execute on function private.manager_spent(uuid, uuid) from public, anon, authenticated;

-- As in #422, and no bid once the time of the open round is over, until the job has closed it.
create or replace function private.lock_manager_bidder(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_opened timestamptz;
begin
  perform 1 from manager_members
  where league_id = p_league and user_id = auth.uid() for update;
  if not found then
    raise exception 'only a participant bids' using errcode = '42501';
  end if;
  select mercato_opened_at into v_opened from manager_leagues where id = p_league;
  if v_opened is null or v_opened > now() then
    raise exception 'mercato not open' using errcode = 'FT016';
  end if;
  if (select ends_at <= now() from private.manager_open_round(p_league)) then
    raise exception 'round closing' using errcode = 'FT020';
  end if;
end $$;

-- As in #422; the budget left is the budget less what the athletes won cost, and an athlete won
-- takes no more bids.
create or replace function place_manager_bid(p_league uuid, p_athlete uuid, p_amount int) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_price int;
  v_budget int;
  v_others int;
begin
  perform private.lock_manager_bidder(p_league);
  select price into v_price from manager_catalogue(p_league) where athlete_id = p_athlete;
  if v_price is null then
    raise exception 'athlete not in the catalogue' using errcode = 'P0002';
  end if;
  if exists (select 1 from manager_awards where league_id = p_league and athlete_id = p_athlete) then
    raise exception 'athlete already won' using errcode = 'FT019';
  end if;
  if p_amount is null or p_amount < v_price then
    raise exception 'a bid is at least the reference price' using errcode = 'FT017';
  end if;
  select (rules ->> 'budget')::numeric::int into v_budget from manager_leagues where id = p_league;
  select coalesce(sum(amount), 0) into v_others from manager_bids
  where league_id = p_league and user_id = auth.uid() and athlete_id <> p_athlete;
  if private.manager_spent(p_league, auth.uid()) + v_others + p_amount > v_budget then
    raise exception 'over the budget' using errcode = 'FT018';
  end if;
  insert into manager_bids (league_id, user_id, athlete_id, amount)
  values (p_league, auth.uid(), p_athlete, p_amount)
  on conflict (league_id, user_id, athlete_id)
  do update set amount = excluded.amount, bid_at = clock_timestamp();
end $$;

-- As in #421; an athlete won in the league is no longer available.
create or replace function manager_catalogue(p_league uuid)
returns table (athlete_id uuid, slug text, name text, country_code text, sex text,
               discipline text, family text, pb text, sb text, price int, available boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_manager_member(p_league) then
    raise exception 'only a participant reads the catalogue' using errcode = '42501';
  end if;
  return query
  select a.id, a.slug, a.name, a.country_code::text, a.gender::text, d.name, d.family,
         (select r.mark from athlete_records r
          where r.athlete_id = a.id and r.discipline = d.name and r.kind = 'pr'),
         (select r.mark from athlete_records r
          where r.athlete_id = a.id and r.discipline = d.name and r.kind = 'sb'),
         a.manager_price,
         not exists (select 1 from manager_awards w
                     where w.league_id = p_league and w.athlete_id = a.id)
  from athletes a
  join athlete_disciplines ad on ad.athlete_id = a.id and ad.is_primary
  join disciplines d on d.name = ad.discipline
  where a.manager_price is not null and a.kind = 'athlete' and a.gender in ('F', 'M')
    and d.family <> 'relay'
  order by a.name;
end $$;

-- Closes every round due, league by league and in order; returns how many it closed. The
-- participants' rows are locked first, so a bid waits for the close (and then sees the next round).
create function private.close_manager_rounds() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_league uuid;
  v_round int;
  v_ends timestamptz;
  v_closed int := 0;
begin
  for v_league in
    select id from manager_leagues where mercato_opened_at is not null order by id
  loop
    perform 1 from manager_members where league_id = v_league order by user_id for update;
    loop
      select o.round, o.ends_at into v_round, v_ends from private.manager_open_round(v_league) o;
      exit when v_ends is null or v_ends > now();
      insert into manager_rounds (league_id, round, ends_at) values (v_league, v_round, v_ends);
      insert into manager_awards (league_id, athlete_id, user_id, amount, round)
      select distinct on (b.athlete_id) b.league_id, b.athlete_id, b.user_id, b.amount, v_round
      from manager_bids b
      where b.league_id = v_league
        and not exists (select 1 from manager_awards w
                        where w.league_id = b.league_id and w.athlete_id = b.athlete_id)
      order by b.athlete_id, b.amount desc, b.bid_at, b.user_id;
      -- The winning bids became awards; the losing ones free their credits.
      delete from manager_bids where league_id = v_league;
      v_closed := v_closed + 1;
    end loop;
  end loop;
  return v_closed;
end $$;
revoke execute on function private.close_manager_rounds() from public, anon, authenticated;
