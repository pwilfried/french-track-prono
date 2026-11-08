-- League rules (v0.5), decided by the owner (issue #112):
--   * invite codes are easy to read out loud: 6 characters, no 0/O, 1/I/L;
--   * 50 members at most;
--   * the owner cannot leave while other members remain: he hands the league over first; alone,
--     leaving deletes the league;
--   * a league counts the competition in progress when it is created.
-- Leagues and memberships are only written through these functions (security definer), which
-- check who is calling. Error codes: P0002 unknown code or member, 54000 league full,
-- 2BP01 owner who must hand over first, 42501 not allowed.

create function new_invite_code() returns text
language sql volatile set search_path = public, extensions as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 31), 1), '')
  from (select gen_random_bytes(6) as b) r, generate_series(0, 5) as i
$$;

alter table leagues alter column invite_code set default new_invite_code();

-- Creates a league for the competition in progress; the caller is its owner and first member.
create function create_league(p_name text, p_competition_slug text)
returns table (league_id uuid, invite_code text)
language plpgsql security definer set search_path = public as $$
declare
  v_league uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  insert into leagues (name, owner_id) values (trim(p_name), auth.uid())
  returning id, leagues.invite_code into v_league, v_code;
  insert into league_members (league_id, user_id, role) values (v_league, auth.uid(), 'owner');
  insert into league_competitions (league_id, competition_id)
  select v_league, c.id from competitions c where c.slug = p_competition_slug;
  if not found then
    raise exception 'unknown competition' using errcode = 'P0002';
  end if;
  return query select v_league, v_code;
end $$;

-- Joins with an invite code (case and spaces ignored). Joining twice changes nothing.
create or replace function join_league(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_league uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  select id into v_league from leagues
  where invite_code = upper(regexp_replace(p_code, '\s', '', 'g'));
  if v_league is null then
    raise exception 'unknown invite code' using errcode = 'P0002';
  end if;
  if exists (select 1 from league_members where league_id = v_league and user_id = auth.uid()) then
    return v_league;
  end if;
  if (select count(*) from league_members where league_id = v_league) >= 50 then
    raise exception 'league full' using errcode = '54000';
  end if;
  insert into league_members (league_id, user_id) values (v_league, auth.uid());
  return v_league;
end $$;

-- Leaves a league. The owner must hand it over first, unless he is alone: then it is deleted.
create function leave_league(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from leagues where id = p_league and owner_id = auth.uid()) then
    if exists (select 1 from league_members where league_id = p_league and user_id <> auth.uid()) then
      raise exception 'hand the league over first' using errcode = '2BP01';
    end if;
    delete from leagues where id = p_league;
  else
    delete from league_members where league_id = p_league and user_id = auth.uid();
  end if;
end $$;

-- The owner hands the league over to a member still in it.
create function transfer_league(p_league uuid, p_new_owner uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from leagues where id = p_league and owner_id = auth.uid()) then
    raise exception 'only the owner can hand the league over' using errcode = '42501';
  end if;
  if p_new_owner = auth.uid()
     or not exists (select 1 from league_members where league_id = p_league and user_id = p_new_owner) then
    raise exception 'unknown member' using errcode = 'P0002';
  end if;
  update leagues set owner_id = p_new_owner where id = p_league;
  update league_members set role = case when user_id = p_new_owner then 'owner' else 'member' end::league_role
  where league_id = p_league and user_id in (p_new_owner, auth.uid());
end $$;

-- Direct writes are closed: everything goes through the functions above.
drop policy owner_insert on leagues;
drop policy owner_update on leagues;
drop policy owner_write on league_competitions;
drop policy leave_league on league_members;

revoke execute on function create_league(text, text), join_league(text), leave_league(uuid),
  transfer_league(uuid, uuid) from public, anon;
grant execute on function create_league(text, text), join_league(text), leave_league(uuid),
  transfer_league(uuid, uuid) to authenticated;

-- The ranking is computed in TypeScript from the score lines (decision B, src/domain). These views
-- were never used, read keys the score lines do not have, and as definer views they would bypass
-- the members-only rule: removed.
drop view leaderboard_league;
drop view leaderboard_competition;
