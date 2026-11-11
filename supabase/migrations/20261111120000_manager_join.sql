-- French Track Manager, v0.12 (#420): joining a Manager league. A public league is joined in one
-- tap while places are left; a private one with its code or link. 12 participants at most, and
-- nobody joins once the mercato is open (mercato_opened_at, set by the mercato in v0.13).
-- Wrong codes count in league_join_failures, like the prediction leagues (#155).
-- Error codes: 42501 not signed in, P0002 unknown public league, 54000 league full,
-- FT012 too many wrong codes, FT015 mercato open.

alter table manager_leagues add column mercato_opened_at timestamptz;

-- Adds the caller to a league (shared by both ways in). The row lock keeps the 12 places when
-- two players join at the same time.
create function private.enter_manager_league(p_league uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_opened timestamptz;
begin
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
revoke execute on function private.enter_manager_league(uuid) from public, anon, authenticated;

-- Joins with an invite code (case and spaces ignored); null for an unknown code.
create function join_manager_league(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_league uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if (select count(*) from league_join_failures
      where user_id = auth.uid() and at > now() - interval '1 hour') >= 10 then
    raise exception 'too many wrong codes, try again later' using errcode = 'FT012';
  end if;
  select id into v_league from manager_leagues
  where invite_code = upper(regexp_replace(p_code, '\s', '', 'g'));
  if v_league is null then
    insert into league_join_failures (user_id) values (auth.uid());
    return null;
  end if;
  return private.enter_manager_league(v_league);
end $$;
revoke execute on function join_manager_league(text) from public, anon;
grant execute on function join_manager_league(text) to authenticated;

-- Joins a public league in one tap, without its code.
create function join_public_manager_league(p_league uuid) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if not exists (select 1 from manager_leagues where id = p_league and is_public) then
    raise exception 'unknown public league' using errcode = 'P0002';
  end if;
  return private.enter_manager_league(p_league);
end $$;
revoke execute on function join_public_manager_league(uuid) from public, anon;
grant execute on function join_public_manager_league(uuid) to authenticated;

-- The public leagues the caller can still join: places left, mercato not open, not in it yet.
create function list_public_manager_leagues()
returns table (league_id uuid, name text, member_count bigint)
language sql stable security definer set search_path = public as $$
  select l.id, l.name, count(m.user_id)
  from manager_leagues l
  left join manager_members m on m.league_id = l.id
  where l.is_public and l.mercato_opened_at is null
    and not is_manager_member(l.id)
  group by l.id, l.name
  having count(m.user_id) < 12
  order by l.name
$$;
revoke execute on function list_public_manager_leagues() from public, anon;
grant execute on function list_public_manager_leagues() to authenticated;
