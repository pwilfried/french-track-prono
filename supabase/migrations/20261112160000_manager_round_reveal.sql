-- French Track Manager, v0.14 (#604): the reveal at the end of each round. While a round is open
-- every bid stays secret (manager_bids, a player reads their own). When it closes, every bid of
-- the round is kept in manager_round_bids, with whether it won, and every participant of the
-- league reads them all: who bid on which athlete, how much, and who got them.
-- manager_members.revealed_round remembers the last round whose reveal the player saw, so the
-- reveal shows once per round and per player (mark_manager_round_revealed).

create table manager_round_bids (
  league_id  uuid not null,
  round      int not null,
  user_id    uuid not null,
  athlete_id uuid not null references athletes(id) on delete cascade,
  amount     int not null check (amount > 0),
  bid_at     timestamptz not null,
  won        boolean not null,
  primary key (league_id, round, user_id, athlete_id),
  foreign key (league_id, round) references manager_rounds (league_id, round) on delete cascade,
  foreign key (league_id, user_id) references manager_members (league_id, user_id) on delete cascade
);

alter table manager_round_bids enable row level security;
-- Rows exist only once their round is closed: every participant of the league reads them.
create policy read_member on manager_round_bids for select to authenticated
  using (is_manager_member(league_id));
revoke insert, update, delete, truncate on manager_round_bids from anon, authenticated;

alter table manager_members add column revealed_round int not null default 0;

-- As in #424, and every bid of the round is kept, with whether it won, before the bids are deleted.
create or replace function private.award_manager_round(p_league uuid, p_round int, p_ends timestamptz)
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
  insert into manager_round_bids (league_id, round, user_id, athlete_id, amount, bid_at, won)
  select b.league_id, p_round, b.user_id, b.athlete_id, b.amount, b.bid_at,
         exists (select 1 from manager_awards w
                 where w.league_id = b.league_id and w.athlete_id = b.athlete_id
                   and w.user_id = b.user_id and w.round = p_round)
  from manager_bids b
  where b.league_id = p_league;
  delete from manager_bids where league_id = p_league;
end $$;

-- The closed rounds of a league in which somebody bid, in order, and whether the caller saw their
-- reveal. Security invoker: row level security shows an outsider nothing.
create function manager_bid_rounds(p_league uuid) returns table (round int, seen boolean)
language sql stable set search_path = public as $$
  select r.round,
         r.round <= coalesce((select m.revealed_round from manager_members m
                              where m.league_id = p_league and m.user_id = auth.uid()), 0)
  from (select distinct b.round from manager_round_bids b where b.league_id = p_league) r
  order by r.round
$$;
revoke execute on function manager_bid_rounds(uuid) from public, anon;
grant execute on function manager_bid_rounds(uuid) to authenticated;

-- The caller saw the reveal of a closed round: it does not show again. Never goes back.
create function mark_manager_round_revealed(p_league uuid, p_round int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_manager_member(p_league) then
    raise exception 'only a participant sees the reveal' using errcode = '42501';
  end if;
  if not exists (select 1 from manager_rounds where league_id = p_league and round = p_round) then
    raise exception 'round not closed' using errcode = 'P0002';
  end if;
  update manager_members set revealed_round = greatest(revealed_round, p_round)
  where league_id = p_league and user_id = auth.uid();
end $$;
revoke execute on function mark_manager_round_revealed(uuid, int) from public, anon;
grant execute on function mark_manager_round_revealed(uuid, int) to authenticated;
