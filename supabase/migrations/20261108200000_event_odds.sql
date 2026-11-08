-- Odds (v0.9): for each event, the admin proposes 5 or 6 athletes of the start list with a
-- multiplier each, plus one for « autre athlète » (athlete_id null). Lower odds = favourite.
-- Competitions created in the back-office play with odds: their events open to predictions only
-- once the odds are set. Existing competitions keep playing without odds.
alter table competitions add column odds_enabled boolean not null default false;

create table event_odds (
  event_id   uuid not null references events(id) on delete cascade,
  athlete_id uuid references athletes(id) on delete cascade,
  odds       numeric(6, 2) not null check (odds > 1)
);
create unique index event_odds_key on event_odds (event_id, coalesce(athlete_id, '00000000-0000-0000-0000-000000000000'));

alter table event_odds enable row level security;
create policy read_all on event_odds for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on event_odds from anon, authenticated;

alter table admin_actions drop constraint admin_actions_action_check;
alter table admin_actions add constraint admin_actions_action_check
  check (action in ('set_start_list', 'set_results', 'run_scoring', 'set_tolerance', 'edit_athlete',
                    'edit_competition', 'set_odds'));

-- A competition created in the back-office plays with odds.
create or replace function admin_create_competition(
  p_slug text, p_name text, p_scope text, p_city text, p_country text,
  p_starts_on date, p_ends_on date, p_time_zone text
) returns text language plpgsql security definer set search_path = public as $$
declare
  candidate text := p_slug;
  n int := 1;
begin
  if not is_admin() then
    raise exception 'only an admin can create a competition' using errcode = '42501';
  end if;
  while exists (select 1 from competitions where slug = candidate) loop
    n := n + 1;
    candidate := p_slug || '-' || n;
  end loop;
  insert into competitions (slug, name, scope, city, country_code, starts_on, ends_on, time_zone, odds_enabled)
  values (candidate, p_name, p_scope, nullif(p_city, ''), nullif(upper(p_country), ''), p_starts_on, p_ends_on,
          p_time_zone, true);
  perform private.log_admin_action('edit_competition', null,
    jsonb_build_object('competition', candidate, 'name', p_name));
  return candidate;
end $$;

-- A final opens once its rounds are run and, when its competition plays with odds, its odds set.
create or replace function is_predictable(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select e.round = 'final'
     and not exists (select 1 from events r where r.parent_id = e.id and r.status <> 'finished')
     and (not c.odds_enabled or exists (select 1 from event_odds o where o.event_id = e.id))
  from events e join competitions c on c.id = e.competition_id where e.id = p_event
$$;

-- Replaces the odds of an event: 5 or 6 athletes of its start list and « autre athlète » (null).
-- Refused once the event is locked (FT005) or when the set is not valid (22023).
create function admin_set_event_odds(p_event uuid, p_odds jsonb) returns void
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
  if v_athletes not between 5 and 6
     or v_athletes <> (select count(*) from jsonb_array_elements(p_odds) o where o ->> 'athlete_id' is not null)
     or (select count(*) from jsonb_array_elements(p_odds) o where o ->> 'athlete_id' is null) <> 1 then
    raise exception 'odds need 5 or 6 athletes of the start list and one for another athlete' using errcode = '22023';
  end if;
  delete from event_odds where event_id = p_event;
  insert into event_odds (event_id, athlete_id, odds)
  select p_event, (o ->> 'athlete_id')::uuid, (o ->> 'odds')::numeric from jsonb_array_elements(p_odds) o;
  perform private.log_admin_action('set_odds', p_event, p_odds);
end $$;

revoke execute on function admin_set_event_odds(uuid, jsonb) from public, anon;
grant execute on function admin_set_event_odds(uuid, jsonb) to authenticated;
