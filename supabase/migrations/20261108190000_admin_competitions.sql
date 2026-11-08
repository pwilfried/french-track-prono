-- Competitions in the back-office (v0.9): the admin creates a competition (international or
-- French), its events and its entered athletes. Start lists and odds are picked among the
-- entered athletes. Every write goes through these functions (admin only, logged).
alter table competitions
  add column scope text not null default 'international' check (scope in ('international', 'france')),
  add column time_zone text not null default 'Europe/Paris';
update competitions set time_zone = 'Europe/Budapest' where slug = 'ultimate-championship-2026';

-- An event is found by its slug alone (the back-office links across competitions).
create unique index events_slug_key on events (slug);

create table competition_athletes (
  competition_id uuid not null references competitions(id) on delete cascade,
  athlete_id     uuid not null references athletes(id) on delete cascade,
  primary key (competition_id, athlete_id)
);
alter table competition_athletes enable row level security;
create policy read_all on competition_athletes for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on competition_athletes from anon, authenticated;

-- Everyone already on a start list is entered in its competition (backfill and from now on).
insert into competition_athletes (competition_id, athlete_id)
select distinct e.competition_id, en.athlete_id from entries en join events e on e.id = en.event_id
on conflict do nothing;

create function enter_start_list_athlete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into competition_athletes (competition_id, athlete_id)
  select competition_id, new.athlete_id from events where id = new.event_id
  on conflict do nothing;
  return new;
end $$;
create trigger enter_start_list_athlete after insert on entries
  for each row execute function enter_start_list_athlete();

alter table admin_actions drop constraint admin_actions_action_check;
alter table admin_actions add constraint admin_actions_action_check
  check (action in ('set_start_list', 'set_results', 'run_scoring', 'set_tolerance', 'edit_athlete',
                    'edit_competition'));

-- Creates a competition; the slug comes from the app, with a number added when taken.
create function admin_create_competition(
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
  insert into competitions (slug, name, scope, city, country_code, starts_on, ends_on, time_zone)
  values (candidate, p_name, p_scope, nullif(p_city, ''), nullif(upper(p_country), ''), p_starts_on, p_ends_on, p_time_zone);
  perform private.log_admin_action('edit_competition', null,
    jsonb_build_object('competition', candidate, 'name', p_name));
  return candidate;
end $$;

-- Adds an event to a competition; the slug comes from the app, with a number added when taken.
create function admin_add_event(
  p_competition text, p_slug text, p_discipline text, p_gender text, p_round text,
  p_starts_at timestamptz, p_lock_at timestamptz
) returns text language plpgsql security definer set search_path = public as $$
declare
  candidate text := p_slug;
  n int := 1;
  v_competition uuid;
  v_event uuid;
begin
  if not is_admin() then
    raise exception 'only an admin can add an event' using errcode = '42501';
  end if;
  select id into v_competition from competitions where slug = p_competition;
  if v_competition is null then
    raise exception 'unknown competition' using errcode = 'FT004';
  end if;
  while exists (select 1 from events where slug = candidate) loop
    n := n + 1;
    candidate := p_slug || '-' || n;
  end loop;
  insert into events (competition_id, slug, discipline, gender, round, starts_at, lock_at)
  values (v_competition, candidate, p_discipline, p_gender, p_round, p_starts_at, p_lock_at)
  returning id into v_event;
  perform private.log_admin_action('edit_competition', v_event,
    jsonb_build_object('competition', p_competition, 'event', candidate));
  return candidate;
end $$;

-- Enters an athlete in a competition, or withdraws them (not if already on a start list).
create function admin_set_competition_athlete(p_competition text, p_athlete uuid, p_entered boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_competition uuid;
begin
  if not is_admin() then
    raise exception 'only an admin can enter an athlete' using errcode = '42501';
  end if;
  select id into v_competition from competitions where slug = p_competition;
  if v_competition is null then
    raise exception 'unknown competition' using errcode = 'FT004';
  end if;
  if p_entered then
    insert into competition_athletes (competition_id, athlete_id) values (v_competition, p_athlete)
    on conflict do nothing;
  else
    if exists (select 1 from entries en join events e on e.id = en.event_id
               where e.competition_id = v_competition and en.athlete_id = p_athlete) then
      raise exception 'the athlete is on a start list' using errcode = '23503';
    end if;
    delete from competition_athletes where competition_id = v_competition and athlete_id = p_athlete;
  end if;
  perform private.log_admin_action('edit_competition', null,
    jsonb_build_object('competition', p_competition, 'athlete', p_athlete, 'entered', p_entered));
end $$;

revoke execute on function admin_create_competition(text, text, text, text, text, date, date, text) from public, anon;
revoke execute on function admin_add_event(text, text, text, text, text, timestamptz, timestamptz) from public, anon;
revoke execute on function admin_set_competition_athlete(text, uuid, boolean) from public, anon;
grant execute on function admin_create_competition(text, text, text, text, text, date, date, text) to authenticated;
grant execute on function admin_add_event(text, text, text, text, text, timestamptz, timestamptz) to authenticated;
grant execute on function admin_set_competition_athlete(text, uuid, boolean) to authenticated;
