-- French Track Manager, v0.16 (#605): a head-to-head shows both lineups on the stadium. A lineup
-- stays private until the lock of its competition (manager_lineups: a player reads their own);
-- from the lock on, every participant of the league reads every lineup of that competition.
-- Error codes: 42501 not a participant, P0002 not an eligible competition of the league.

-- Whether the lineups of a competition of the league are locked, and, once they are, every
-- validated lineup of it ([{user_id, athlete_ids}], the athletes in the order they were
-- validated). Before the lock: locked false, no lineup.
create function manager_duel_lineups(p_league uuid, p_competition uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_locked boolean;
begin
  if not is_manager_member(p_league) then
    raise exception 'only a participant reads the lineups' using errcode = '42501';
  end if;
  if not exists (select 1 from manager_leagues
                 where id = p_league and p_competition = any(competition_ids)) then
    raise exception 'not an eligible competition of the league' using errcode = 'P0002';
  end if;
  v_locked := now() >= private.manager_lineup_lock(p_competition);
  return jsonb_build_object(
    'locked', v_locked,
    'lineups', case when v_locked then coalesce((
      select jsonb_agg(jsonb_build_object('user_id', ml.user_id,
                                          'athlete_ids', to_jsonb(ml.athlete_ids))
                       order by ml.user_id)
      from manager_lineups ml
      where ml.league_id = p_league and ml.competition_id = p_competition), '[]'::jsonb)
    else '[]'::jsonb end);
end $$;
revoke execute on function manager_duel_lineups(uuid, uuid) from public, anon;
grant execute on function manager_duel_lineups(uuid, uuid) to authenticated;
