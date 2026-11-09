-- #375 (decision of 9 Nov 2026): a player predicts without being in a league again. The check
-- added by #311 (FT011) is removed; leagues become a suggestion. in_league_of_competition() stays
-- for the pages that suggest a league.
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
