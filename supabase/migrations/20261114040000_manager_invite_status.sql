-- French Track Manager (#781): the invite link says why a league is closed before the player taps.
-- Nobody joins once the mercato is open (FT015) nor beyond the players its competitions call for
-- (player_target, 54000): private.enter_manager_league refuses both. This tells the same thing to
-- the page, without joining:
--   'open'          the button works (a participant tapping again is taken to the league);
--   'mercato_open'  the mercato is open, whether launched by the creator or opened by the job;
--   'full'          the league holds its player_target;
--   null            unknown code, counted in league_join_failures as when joining (#155).
-- Error codes: 42501 not signed in, FT012 too many wrong codes.

create function manager_invite_status(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare v_league manager_leagues;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if (select count(*) from league_join_failures
      where user_id = auth.uid() and at > now() - interval '1 hour') >= 10 then
    raise exception 'too many wrong codes, try again later' using errcode = 'FT012';
  end if;
  select * into v_league from manager_leagues
  where invite_code = upper(regexp_replace(p_code, '\s', '', 'g'));
  if v_league.id is null then
    insert into league_join_failures (user_id) values (auth.uid());
    return null;
  end if;
  if is_manager_member(v_league.id) then
    return 'open';
  end if;
  if v_league.mercato_opened_at is not null then
    return 'mercato_open';
  end if;
  if (select count(*) from manager_members where league_id = v_league.id)
     >= v_league.player_target then
    return 'full';
  end if;
  return 'open';
end $$;
revoke execute on function manager_invite_status(text) from public, anon;
grant execute on function manager_invite_status(text) to authenticated;
