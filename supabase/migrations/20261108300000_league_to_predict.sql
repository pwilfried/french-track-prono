-- v0.7 (#311), decided by the owner: to predict on an event, a player must be in a league that
-- counts its competition. Error code FT011. The general ranking still counts every player.

-- Whether a player is in a league counting a competition; security definer, so the check does not
-- depend on which memberships the caller may read.
create function in_league_of_competition(p_user uuid, p_competition uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from league_members m
    join league_competitions lc on lc.league_id = m.league_id
    where m.user_id = p_user and lc.competition_id = p_competition
  )
$$;
revoke execute on function in_league_of_competition(uuid, uuid) from public, anon;
grant execute on function in_league_of_competition(uuid, uuid) to authenticated;

create or replace function enforce_prediction_lock() returns trigger
language plpgsql as $$
declare
  v_lock timestamptz;
  v_comp uuid;
  v_odds boolean;
begin
  select e.lock_at, e.competition_id, c.odds_enabled into v_lock, v_comp, v_odds
  from events e join competitions c on c.id = e.competition_id where e.id = new.event_id;
  if now() >= v_lock then
    raise exception 'prediction locked: the event has started' using errcode = 'P0001';
  end if;
  if not is_predictable(new.event_id) then
    raise exception 'prediction not open: earlier rounds or odds missing' using errcode = 'FT001';
  end if;
  -- #311: a player predicts from a league counting the competition. Only checked for players
  -- (API role authenticated); the seed and the admin scripts write as postgres.
  if current_user = 'authenticated' and not in_league_of_competition(new.user_id, v_comp) then
    raise exception 'join a league counting this competition first' using errcode = 'FT011';
  end if;
  if not v_odds and num_nulls(new.p1, new.p2, new.p3) > 0 then
    raise exception 'another athlete is only offered with odds' using errcode = 'FT006';
  end if;
  if v_odds and exists (
    select 1 from unnest(array[new.p1, new.p2, new.p3]) as pick(athlete_id)
    where pick.athlete_id is not null
      and not exists (select 1 from event_odds o
                      where o.event_id = new.event_id and o.athlete_id = pick.athlete_id)
  ) then
    raise exception 'athlete not proposed for this event' using errcode = 'FT006';
  end if;
  new.competition_id := v_comp;
  new.updated_at := now();
  return new;
end $$;
