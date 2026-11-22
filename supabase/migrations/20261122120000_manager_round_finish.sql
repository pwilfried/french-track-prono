-- French Track Manager (#1084): a participant who is done with a mercato round says so
-- (« J'ai fini ce tour »): they bid no more and change none of their bids until the next round.
-- Once every participant of the league is done, the round closes at once, as at its normal end
-- (awards, reveal, next round). The next rounds keep their planned length from that early close:
-- the time won is kept in manager_leagues.mercato_advance and every round end is computed from
-- mercato_opened_at - mercato_advance (the same rule as src/domain/manager-round.ts, which reads
-- the real closes of the closed rounds). Once everyone is done with the last planned round (3,
-- PLANNED_ROUNDS), the mercato ends as usual (private.finish_manager_mercato).
-- A participant still bidding keeps the round until its planned end, as before.
-- Error codes: FT044 the caller finished the round (no bid, no withdrawal until the next one).

alter table manager_leagues add column mercato_advance interval not null default '0';

-- Who finished which round. Written only by finish_manager_round(), for the caller, while the
-- round is open; the participants of the league read it (« en attente des autres (2/5) »).
create table manager_round_done (
  league_id   uuid not null,
  round       int not null check (round > 0),
  user_id     uuid not null,
  finished_at timestamptz not null default now(),
  primary key (league_id, round, user_id),
  foreign key (league_id, user_id) references manager_members (league_id, user_id) on delete cascade
);

alter table manager_round_done enable row level security;
create policy read_member on manager_round_done for select to authenticated
  using (is_manager_member(league_id));
revoke insert, update, delete, truncate on manager_round_done from anon, authenticated;

-- As in #424; the rounds start mercato_advance earlier once a round closed early (#1084).
create or replace function private.manager_open_round(p_league uuid)
returns table (round int, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.n,
         l.mercato_opened_at - l.mercato_advance + make_interval(hours =>
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

-- True when p_user finished the open round of the league.
create function private.manager_round_finished(p_league uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from manager_round_done d
                 join private.manager_open_round(p_league) o on o.round = d.round
                 where d.league_id = p_league and d.user_id = p_user)
$$;
revoke execute on function private.manager_round_finished(uuid, uuid)
  from public, anon, authenticated;

-- As in #424; no bid nor withdrawal from a participant who finished the round (FT044).
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
  if private.manager_round_finished(p_league, auth.uid()) then
    raise exception 'round finished' using errcode = 'FT044';
  end if;
end $$;

-- The open round of the caller's league: its number, its end, whether the caller finished it,
-- how many participants did and how many there are. Nothing outside the league or the mercato.
create function manager_round_progress(p_league uuid)
returns table (round int, ends_at timestamptz, done boolean, finished int, members int)
language sql stable security definer set search_path = public as $$
  select o.round, o.ends_at,
         exists (select 1 from manager_round_done d
                 where d.league_id = p_league and d.round = o.round and d.user_id = auth.uid()),
         (select count(*)::int from manager_round_done d
          where d.league_id = p_league and d.round = o.round),
         (select count(*)::int from manager_members m where m.league_id = p_league)
  from private.manager_open_round(p_league) o
  where is_manager_member(p_league)
    and exists (select 1 from manager_leagues l
                where l.id = p_league and l.mercato_opened_at <= now())
$$;
revoke execute on function manager_round_progress(uuid) from public, anon;
grant execute on function manager_round_progress(uuid) to authenticated;

-- The caller finished the open round; once every participant did, the round closes now, as the
-- job would at its end, and the next one opens for its planned length. After the last planned
-- round, or once nobody can recruit any more (if the rules allow it), the mercato ends. Saying it
-- twice changes nothing. Every participant is locked, so the last two to finish cannot both
-- miss the close.
create function finish_manager_round(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_league manager_leagues;
  v_round int;
  v_ends timestamptz;
begin
  if not is_manager_member(p_league) then
    raise exception 'only a participant finishes a round' using errcode = '42501';
  end if;
  perform 1 from manager_members where league_id = p_league order by user_id for update;
  select * into v_league from manager_leagues where id = p_league;
  if v_league.mercato_opened_at is null or v_league.mercato_opened_at > now()
     or v_league.mercato_closed_at is not null then
    raise exception 'mercato not open' using errcode = 'FT016';
  end if;
  select o.round, o.ends_at into v_round, v_ends from private.manager_open_round(p_league) o;
  if v_ends <= now()
     or (v_league.mercato_closes_at <= now()
         and private.manager_close_allowed(p_league, 'scheduled')) then
    raise exception 'round closing' using errcode = 'FT020';
  end if;
  insert into manager_round_done (league_id, round, user_id)
  values (p_league, v_round, auth.uid())
  on conflict do nothing;
  if (select count(*) from manager_round_done where league_id = p_league and round = v_round)
     < (select count(*) from manager_members where league_id = p_league) then
    return;
  end if;
  update manager_leagues set mercato_advance = mercato_advance + (v_ends - now())
  where id = p_league;
  perform private.award_manager_round(p_league, v_round, now());
  if v_round >= 3
     or (private.manager_close_allowed(p_league, 'budgets_spent')
         and not exists (select 1 from private.manager_recruiters(p_league))) then
    perform private.finish_manager_mercato(p_league);
  end if;
end $$;
revoke execute on function finish_manager_round(uuid) from public, anon;
grant execute on function finish_manager_round(uuid) to authenticated;

-- The « mercato_round » reminder of #836 leaves out the participants who finished the round.
alter function private.manager_reminder_due(timestamptz) rename to manager_reminder_candidates;

create function private.manager_reminder_due(p_now timestamptz default now())
returns table (user_id uuid, kind text, evening date, ref text, payload jsonb)
language sql stable security definer set search_path = public as $$
  select c.user_id, c.kind, c.evening, c.ref, c.payload
  from private.manager_reminder_candidates(p_now) c
  where not (c.kind = 'mercato_round'
             and exists (select 1 from manager_round_done d
                         where d.league_id = (c.payload ->> 'league_id')::uuid
                           and d.round = (c.payload ->> 'round')::int
                           and d.user_id = c.user_id))
$$;
revoke execute on function private.manager_reminder_due(timestamptz)
  from public, anon, authenticated;
