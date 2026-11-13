-- French Track Manager (#619): the creator sets the mercato of their league, then launches it.
--   player_target      an even number of players, 4 to 10: everyone has an opponent on each
--                      matchday. A league is full at its target; the creator may change it while
--                      the mercato is not open, never under the players already in.
--   mercato_starts_at  the mercato opens by itself at that time if and only if the target is
--                      reached (private.open_manager_mercatos, run by the Manager rounds job);
--                      otherwise it waits.
--   round_mode         'auto': the rounds of French Track rules (set by its admin, copied into
--                      rules.rounds); 'custom': the creator picks the first round and the next ones
--                      (12, 24, 48 or 72 hours), written into rules.rounds with longRounds = 1.
-- The creator also launches the mercato now, once the target is reached. Joining closes when the
-- mercato opens (FT015, as in #420). The same rules are in src/domain/manager-league.ts.
-- Error codes: 42501 not the creator, FT015 mercato already open, FT025 target refused (odd, out
-- of 4 to 10, or under the players already in), FT026 players still missing, 22023 rounds refused.

alter table manager_leagues
  add column player_target int not null default 4
    check (player_target between 4 and 10 and player_target % 2 = 0),
  add column mercato_starts_at timestamptz,
  add column round_mode text not null default 'auto' check (round_mode in ('auto', 'custom'));

-- The leagues already created wait for the even number of players they have (4 to 10).
update manager_leagues l
set player_target = least(10, greatest(4,
  ((select count(*) from manager_members m where m.league_id = l.id) + 1) / 2 * 2));

-- As in #420, full at the target of the league instead of 12.
create or replace function private.enter_manager_league(p_league uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_league manager_leagues;
begin
  select * into v_league from manager_leagues where id = p_league for update;
  if exists (select 1 from manager_members where league_id = p_league and user_id = auth.uid()) then
    return p_league;
  end if;
  if v_league.mercato_opened_at is not null then
    raise exception 'mercato open' using errcode = 'FT015';
  end if;
  if (select count(*) from manager_members where league_id = p_league) >= v_league.player_target
  then
    raise exception 'league full' using errcode = '54000';
  end if;
  insert into manager_members (league_id, user_id) values (p_league, auth.uid());
  return p_league;
end $$;

-- As in #420, with the places left under the target of each league, and that target.
drop function list_public_manager_leagues();
create function list_public_manager_leagues()
returns table (league_id uuid, name text, member_count bigint, player_target int)
language sql stable security definer set search_path = public as $$
  select l.id, l.name, count(m.user_id), l.player_target
  from manager_leagues l
  left join manager_members m on m.league_id = l.id
  where l.is_public and l.mercato_opened_at is null
    and not is_manager_member(l.id)
  group by l.id, l.name, l.player_target
  having count(m.user_id) < l.player_target
  order by l.name
$$;
revoke execute on function list_public_manager_leagues() from public, anon;
grant execute on function list_public_manager_leagues() to authenticated;

-- Locks a league its caller created and whose mercato is not open yet.
create function private.lock_manager_creator(p_league uuid) returns manager_leagues
language plpgsql security definer set search_path = public as $$
declare v_league manager_leagues;
begin
  select * into v_league from manager_leagues where id = p_league for update;
  if auth.uid() is null or v_league.owner_id is distinct from auth.uid() then
    raise exception 'only the creator sets the mercato' using errcode = '42501';
  end if;
  if v_league.mercato_opened_at is not null then
    raise exception 'mercato open' using errcode = 'FT015';
  end if;
  return v_league;
end $$;
revoke execute on function private.lock_manager_creator(uuid) from public, anon, authenticated;

-- The creator sets the mercato of their league while it is not open.
create function set_manager_mercato(
  p_league uuid, p_target int, p_starts_at timestamptz, p_mode text,
  p_first_hours int default null, p_next_hours int default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_members int;
begin
  perform private.lock_manager_creator(p_league);
  v_members := (select count(*) from manager_members where league_id = p_league);
  if p_target is null or p_target not between 4 and 10 or p_target % 2 <> 0
     or p_target < v_members then
    raise exception 'player target refused' using errcode = 'FT025';
  end if;
  if p_mode is null or p_mode not in ('auto', 'custom')
     or (p_mode = 'custom' and (p_first_hours is null or p_first_hours not in (12, 24, 48, 72)
                                or p_next_hours is null or p_next_hours not in (12, 24, 48, 72)))
  then
    raise exception 'rounds refused' using errcode = '22023';
  end if;
  update manager_leagues
  set player_target = p_target,
      mercato_starts_at = p_starts_at,
      round_mode = p_mode,
      rules = jsonb_set(rules, '{rounds}',
        case when p_mode = 'auto' then (select r.rules -> 'rounds' from manager_rules r)
             else jsonb_build_object('firstHours', p_first_hours, 'longRounds', 1,
                                     'nextHours', p_next_hours) end)
  where id = p_league;
end $$;
revoke execute on function set_manager_mercato(uuid, int, timestamptz, text, int, int)
  from public, anon;
grant execute on function set_manager_mercato(uuid, int, timestamptz, text, int, int)
  to authenticated;

-- The creator launches the mercato now, once the target is reached: round 1 opens.
create function launch_manager_mercato(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_league manager_leagues;
begin
  v_league := private.lock_manager_creator(p_league);
  if (select count(*) from manager_members where league_id = p_league) <> v_league.player_target
  then
    raise exception 'players missing' using errcode = 'FT026';
  end if;
  update manager_leagues set mercato_opened_at = now() where id = p_league;
end $$;
revoke execute on function launch_manager_mercato(uuid) from public, anon;
grant execute on function launch_manager_mercato(uuid) to authenticated;

-- Opens the mercato of each league whose time has come and whose target is reached; the others
-- wait. Returns how many it opened.
create function private.open_manager_mercatos() returns int
language plpgsql security definer set search_path = public as $$
declare v_opened int;
begin
  update manager_leagues l
  set mercato_opened_at = now()
  where l.mercato_opened_at is null and l.mercato_starts_at <= now()
    and (select count(*) from manager_members m where m.league_id = l.id) = l.player_target;
  get diagnostics v_opened = row_count;
  return v_opened;
end $$;
revoke execute on function private.open_manager_mercatos() from public, anon, authenticated;

-- As in #424, after opening the mercatos whose time has come.
create or replace function private.close_manager_rounds() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_league manager_leagues;
  v_closed int := 0;
begin
  perform private.open_manager_mercatos();
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
