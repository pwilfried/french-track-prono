-- « Autre athlète » (v0.9, #260): when its competition plays with odds, a player picks among the
-- proposed athletes of an event, and may put « autre athlète » (stored as null) on one place.
-- Without odds, the three places stay athletes of the start list. Error FT006: a choice that is
-- not offered (an athlete not proposed, or « autre athlète » without odds).
alter table predictions
  alter column p1 drop not null,
  alter column p2 drop not null,
  alter column p3 drop not null,
  add constraint predictions_one_other check (num_nulls(p1, p2, p3) <= 1);

-- The lock trigger also checks the choices against the odds.
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
