-- French Track Manager, v0.13 (#422): the secret bids of the mercato. While the mercato of a league
-- is open, a participant bids on several athletes at once, changes or withdraws a bid; the last bid
-- counts. A bid is at least the reference price of the athlete, and the active bids of a player
-- together never reserve more than their available budget (the budget of the league, less what
-- the awards of #423 will spend). The rules are in src/domain/manager-bid.ts.
-- Secrecy: a player reads their own bids only (RLS), and the functions below answer nothing about
-- the others: neither their bids, nor how many, nor a position, nor the best bid.
-- Error codes: 42501 not a participant, FT016 mercato not open, P0002 athlete not in the
-- catalogue, FT017 below the reference price, FT018 over the budget.

create table manager_bids (
  league_id  uuid not null,
  user_id    uuid not null,
  athlete_id uuid not null references athletes(id) on delete cascade,
  amount     int not null check (amount > 0),
  -- Moves with every change: the first bid at the winning amount wins a tie (#423).
  bid_at     timestamptz not null default clock_timestamp(),
  primary key (league_id, user_id, athlete_id),
  foreign key (league_id, user_id) references manager_members (league_id, user_id) on delete cascade
);
create index on manager_bids (league_id, athlete_id);

alter table manager_bids enable row level security;
create policy read_own on manager_bids for select to authenticated
  using (user_id = auth.uid());
revoke insert, update, delete, truncate on manager_bids from anon, authenticated;

-- Checks that the caller takes part in the league and its mercato is open; locks the caller's
-- membership so that two bids of the same player are checked against the budget one after the
-- other.
create function private.lock_manager_bidder(p_league uuid) returns void
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
end $$;
revoke execute on function private.lock_manager_bidder(uuid) from public, anon, authenticated;

-- Places a bid, or replaces the caller's former bid on the athlete.
create function place_manager_bid(p_league uuid, p_athlete uuid, p_amount int) returns void
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
  if p_amount is null or p_amount < v_price then
    raise exception 'a bid is at least the reference price' using errcode = 'FT017';
  end if;
  select (rules ->> 'budget')::numeric::int into v_budget from manager_leagues where id = p_league;
  select coalesce(sum(amount), 0) into v_others from manager_bids
  where league_id = p_league and user_id = auth.uid() and athlete_id <> p_athlete;
  if v_others + p_amount > v_budget then
    raise exception 'over the budget' using errcode = 'FT018';
  end if;
  insert into manager_bids (league_id, user_id, athlete_id, amount)
  values (p_league, auth.uid(), p_athlete, p_amount)
  on conflict (league_id, user_id, athlete_id)
  do update set amount = excluded.amount, bid_at = clock_timestamp();
end $$;
revoke execute on function place_manager_bid(uuid, uuid, int) from public, anon;
grant execute on function place_manager_bid(uuid, uuid, int) to authenticated;

-- Withdraws the caller's bid on an athlete, which frees its credits.
create function withdraw_manager_bid(p_league uuid, p_athlete uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform private.lock_manager_bidder(p_league);
  delete from manager_bids
  where league_id = p_league and user_id = auth.uid() and athlete_id = p_athlete;
end $$;
revoke execute on function withdraw_manager_bid(uuid, uuid) from public, anon;
grant execute on function withdraw_manager_bid(uuid, uuid) to authenticated;
