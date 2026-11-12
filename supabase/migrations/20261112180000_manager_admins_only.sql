-- French Track Manager, v0.14.1 (#615): until the owner opens it to everybody, only the admins
-- play the Manager. The functions a player calls to create or join a league, bid, close the
-- mercato, line up athletes or mark a reveal seen refuse a player who is not an admin, after their
-- own identity check (a caller without identity still gets 42501).
-- The same rule lives in src/domain/manager-access.ts for the pages.
-- Error code: FT025 the Manager is open to the admins only.

create function private.require_manager_player() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'French Track Manager is open to the admins only' using errcode = 'FT025';
  end if;
end $$;
revoke execute on function private.require_manager_player() from public, anon, authenticated;

-- As in #419, for the admins only.
create or replace function create_manager_league(p_name text, p_public boolean)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_league uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  perform private.require_manager_player();
  if is_banned_league_name(v_name) then
    raise exception 'banned name' using errcode = 'FT010';
  end if;
  insert into manager_leagues (name, is_public, owner_id, rules, competition_ids)
  values (v_name, coalesce(p_public, false), auth.uid(),
          (select rules from manager_rules),
          coalesce((select array_agg(competition_id) from manager_competitions), '{}'))
  returning id into v_league;
  insert into manager_members (league_id, user_id) values (v_league, auth.uid());
  return v_league;
end $$;

-- As in #420 (both ways in: code and public league), for the admins only.
create or replace function private.enter_manager_league(p_league uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_opened timestamptz;
begin
  perform private.require_manager_player();
  select mercato_opened_at into v_opened from manager_leagues where id = p_league for update;
  if exists (select 1 from manager_members where league_id = p_league and user_id = auth.uid()) then
    return p_league;
  end if;
  if v_opened is not null then
    raise exception 'mercato open' using errcode = 'FT015';
  end if;
  if (select count(*) from manager_members where league_id = p_league) >= 12 then
    raise exception 'league full' using errcode = '54000';
  end if;
  insert into manager_members (league_id, user_id) values (p_league, auth.uid());
  return p_league;
end $$;

-- As in #424 (placing and withdrawing a bid), for the admins only.
create or replace function private.lock_manager_bidder(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_league manager_leagues;
begin
  perform 1 from manager_members
  where league_id = p_league and user_id = auth.uid() for update;
  if not found then
    raise exception 'only a participant bids' using errcode = '42501';
  end if;
  perform private.require_manager_player();
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

-- As in #424, for the admins only.
create or replace function close_manager_mercato(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_manager_member(p_league) then
    raise exception 'only a participant closes the mercato' using errcode = '42501';
  end if;
  perform private.require_manager_player();
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

-- As in #427, for the admins only.
create or replace function save_manager_lineup(p_league uuid, p_competition uuid, p_athletes uuid[])
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_chosen uuid[] := coalesce(p_athletes, '{}');
  v_eligible boolean;
  v_closed timestamptz;
  v_problem text;
begin
  if not is_manager_member(p_league) then
    raise exception 'only a participant lines up athletes' using errcode = '42501';
  end if;
  perform private.require_manager_player();
  select coalesce(p_competition = any(competition_ids), false), mercato_closed_at
  into v_eligible, v_closed
  from manager_leagues where id = p_league;
  if not v_eligible then
    raise exception 'not an eligible competition of the league' using errcode = 'P0002';
  end if;
  if v_closed is null then
    raise exception 'the mercato is not over' using errcode = 'FT022';
  end if;
  if now() >= private.manager_lineup_lock(p_competition) then
    raise exception 'lineup locked: the competition has started' using errcode = 'FT023';
  end if;
  v_problem := private.manager_lineup_problem(p_league, auth.uid(), p_competition, v_chosen);
  if v_problem is not null then
    raise exception 'not a valid lineup: %', v_problem using errcode = 'FT024';
  end if;
  insert into manager_lineups (league_id, competition_id, user_id, athlete_ids)
  values (p_league, p_competition, auth.uid(), v_chosen)
  on conflict (league_id, competition_id, user_id)
  do update set athlete_ids = excluded.athlete_ids, validated_at = now();
end $$;

-- As in #604, for the admins only.
create or replace function mark_manager_round_revealed(p_league uuid, p_round int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_manager_member(p_league) then
    raise exception 'only a participant sees the reveal' using errcode = '42501';
  end if;
  perform private.require_manager_player();
  if not exists (select 1 from manager_rounds where league_id = p_league and round = p_round) then
    raise exception 'round not closed' using errcode = 'P0002';
  end if;
  update manager_members set revealed_round = greatest(revealed_round, p_round)
  where league_id = p_league and user_id = auth.uid();
end $$;
