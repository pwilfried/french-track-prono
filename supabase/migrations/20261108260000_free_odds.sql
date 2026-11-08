-- Odds (#294, owner's feedback): any positive value, and as many proposed athletes as the admin
-- wants (at least one), plus « autre athlète ».
alter table event_odds drop constraint event_odds_odds_check;
alter table event_odds add constraint event_odds_odds_check check (odds > 0);

create or replace function admin_set_event_odds(p_event uuid, p_odds jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_lock timestamptz;
  v_athletes int;
begin
  if not is_admin() then
    raise exception 'only an admin can set odds' using errcode = '42501';
  end if;
  select lock_at into v_lock from events where id = p_event;
  if v_lock is null then
    raise exception 'unknown event' using errcode = '22023';
  end if;
  if now() >= v_lock then
    raise exception 'odds are frozen once the event is locked' using errcode = 'FT005';
  end if;
  select count(*) into v_athletes from jsonb_array_elements(p_odds) o
  where o ->> 'athlete_id' is not null
    and exists (select 1 from entries en where en.event_id = p_event and en.athlete_id = (o ->> 'athlete_id')::uuid);
  if v_athletes < 1
     or v_athletes <> (select count(*) from jsonb_array_elements(p_odds) o where o ->> 'athlete_id' is not null)
     or (select count(*) from jsonb_array_elements(p_odds) o where o ->> 'athlete_id' is null) <> 1
     or exists (select 1 from jsonb_array_elements(p_odds) o where (o ->> 'odds')::numeric <= 0) then
    raise exception 'odds need athletes of the start list, positive odds, and one for another athlete'
      using errcode = '22023';
  end if;
  delete from event_odds where event_id = p_event;
  insert into event_odds (event_id, athlete_id, odds)
  select p_event, (o ->> 'athlete_id')::uuid, (o ->> 'odds')::numeric from jsonb_array_elements(p_odds) o;
  perform private.log_admin_action('set_odds', p_event, p_odds);
end $$;
