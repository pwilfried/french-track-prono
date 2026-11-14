-- #780: a prediction league is closed to newcomers once it has started, that is once the first
-- event of one of its competitions is locked (no prediction possible any more). This replaces
-- #376, where a newcomer only counted the events locked after their arrival. The official league
-- (#553) stays open: everyone is in it. A member who joins again is simply taken to it.
-- Manager leagues are not concerned (they have their own tables).
-- Error code: FT032 the league has started.

-- True once the first event of one of the league's competitions is locked.
create function private.league_has_started(p_league uuid)
returns boolean language sql stable set search_path = public as $$
  select exists (
    select 1 from league_competitions lc
    join events e on e.competition_id = lc.competition_id
    where lc.league_id = p_league and e.lock_at <= now()
  )
$$;
revoke execute on function private.league_has_started(uuid) from public, anon, authenticated;

-- Shared by join_league and join_public_league.
create or replace function enter_league(p_league uuid) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from league_members where league_id = p_league and user_id = auth.uid()) then
    return p_league;
  end if;
  if (select not is_official from leagues where id = p_league)
     and private.league_has_started(p_league) then
    raise exception 'league started' using errcode = 'FT032';
  end if;
  if (select not is_official from leagues where id = p_league)
     and (select count(*) from league_members where league_id = p_league)
         >= (select case when is_public then 200 else 50 end from leagues where id = p_league) then
    raise exception 'league full' using errcode = '54000';
  end if;
  insert into league_members (league_id, user_id) values (p_league, auth.uid());
  return p_league;
end $$;

-- The started leagues leave « Découvrir » (the official one stays).
create or replace function list_public_leagues()
returns table (league_id uuid, name text, member_count bigint, competition_slugs text[],
               is_official boolean, families text[], created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.id, l.name,
         (select count(*) from league_members m where m.league_id = l.id),
         coalesce((select array_agg(c.slug order by c.slug) from league_competitions lc
                   join competitions c on c.id = lc.competition_id where lc.league_id = l.id), '{}'),
         l.is_official,
         coalesce((select array_agg(f.family order by f.family) from league_families f
                   where f.league_id = l.id), '{}'),
         l.created_at
  from leagues l
  where l.is_public and (l.is_official or not private.league_has_started(l.id))
  order by l.name
$$;

-- What the invite page shows before any button: 'member' (the button takes them to it), 'open',
-- 'started', or null for an unknown code. An unknown code counts as a wrong code, like join_league,
-- so that this function does not help to guess codes (#155). Error codes: 42501 not signed in,
-- FT012 too many wrong codes.
create function league_invite_status(p_code text) returns text
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
  select id into v_league from leagues
  where invite_code = upper(regexp_replace(p_code, '\s', '', 'g'));
  if v_league is null then
    insert into league_join_failures (user_id) values (auth.uid());
    return null;
  end if;
  if exists (select 1 from league_members where league_id = v_league and user_id = auth.uid()) then
    return 'member';
  end if;
  if (select not is_official from leagues where id = v_league)
     and private.league_has_started(v_league) then
    return 'started';
  end if;
  return 'open';
end $$;
revoke execute on function league_invite_status(text) from public, anon;
grant execute on function league_invite_status(text) to authenticated;
