-- Admin log (v0.8): who entered a start list, a result or computed points, when, and what.
-- One line per call of set_start_list, set_results and set_event_scores, written by the database
-- in the same transaction, so a log line exists if and only if the change happened.
create table admin_actions (
  id       uuid primary key default gen_random_uuid(),
  admin_id uuid references profiles(id) on delete set null,
  action   text not null check (action in ('set_start_list', 'set_results', 'run_scoring')),
  event_id uuid references events(id) on delete cascade,
  payload  jsonb not null default '{}',
  at       timestamptz not null default now()
);
create index on admin_actions (admin_id, at desc);
create index on admin_actions (event_id, at desc);

-- Admins read the log; nobody writes it through the API (no insert, update or delete policy).
alter table admin_actions enable row level security;
create policy admin_read on admin_actions for select to authenticated using (is_admin());
revoke insert, update, delete, truncate on admin_actions from anon, authenticated;

-- The writer lives in a schema the API does not expose: the RPCs below can call it, a client
-- cannot. Security definer: it writes past row level security, always as the signed-in admin.
create schema if not exists private;
grant usage on schema private to authenticated;

create function private.log_admin_action(p_action text, p_event uuid, p_payload jsonb)
returns void language sql security definer set search_path = public as $$
  insert into admin_actions (admin_id, action, event_id, payload)
  values (auth.uid(), p_action, p_event, p_payload)
$$;
revoke execute on function private.log_admin_action(text, uuid, jsonb) from public, anon;
grant execute on function private.log_admin_action(text, uuid, jsonb) to authenticated;

-- The three back-office RPCs, unchanged except for the log line at the end.
create or replace function set_results(p_event uuid, p_lines jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can enter results' using errcode = '42501';
  end if;
  delete from results where event_id = p_event;
  insert into results (event_id, athlete_id, rank, mark)
  select p_event, (l ->> 'athlete_id')::uuid, (l ->> 'rank')::int, nullif(l ->> 'mark', '')
  from jsonb_array_elements(p_lines) as l;
  perform private.log_admin_action('set_results', p_event, p_lines);
end $$;

create or replace function set_event_scores(p_event uuid, p_lines jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can compute points' using errcode = '42501';
  end if;
  delete from score_events where event_id = p_event and source = 'prediction';
  insert into score_events (user_id, competition_id, event_id, source, points, reason, detail)
  select (l ->> 'user_id')::uuid, e.competition_id, p_event, 'prediction', (l ->> 'points')::int,
         'prediction', coalesce(l -> 'detail', '{}'::jsonb)
  from jsonb_array_elements(p_lines) as l
  cross join events e
  where e.id = p_event;
  perform private.log_admin_action('run_scoring', p_event, p_lines);
end $$;

create or replace function set_start_list(p_event uuid, p_entries jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare
  kept uuid[] := array(select (e ->> 'athlete_id')::uuid from jsonb_array_elements(p_entries) e);
begin
  if not is_admin() then
    raise exception 'only an admin can enter a start list' using errcode = '42501';
  end if;
  if exists (select 1 from results r where r.event_id = p_event and r.athlete_id <> all (kept)) then
    raise exception 'an athlete of the result cannot leave the start list' using errcode = '23503';
  end if;
  delete from entries where event_id = p_event and athlete_id <> all (kept);
  insert into entries (event_id, athlete_id, season_best)
  select p_event, (e ->> 'athlete_id')::uuid, nullif(e ->> 'season_best', '')
  from jsonb_array_elements(p_entries) e
  on conflict (event_id, athlete_id) do update set season_best = excluded.season_best;
  perform private.log_admin_action('set_start_list', p_event, p_entries);
end $$;
