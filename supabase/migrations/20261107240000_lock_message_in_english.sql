-- Database error messages are in English like the code (AGENTS.md); the app only reads the code.
-- Same trigger as in the init migration, only the message changes.
create or replace function enforce_prediction_lock() returns trigger
language plpgsql as $$
declare
  v_lock timestamptz;
  v_comp uuid;
begin
  select lock_at, competition_id into v_lock, v_comp from events where id = new.event_id;
  if now() >= v_lock then
    raise exception 'prediction locked: the event has started' using errcode = 'P0001';
  end if;
  new.competition_id := v_comp;
  new.updated_at := now();
  return new;
end $$;
