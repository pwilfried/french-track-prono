-- French Track Manager, v0.15 (#429): the admin enters the performance of every athlete of an
-- event, not only the podium of the predictions: place, mark, records (personal best, season best,
-- national, continental and world record), or DNS, DNF, DQ. The Manager scores from them (World
-- Athletics tables, sporting bonuses); DNS, DNF and DQ score 0 (#416). A new entry replaces the
-- previous one: a corrected result is entered again, and the score is computed again from it.
-- `results` (the official podium of the predictions) is left as it is.
-- Same rules as performanceProblem in src/domain/performance.ts.

create table event_performances (
  event_id   uuid not null,
  athlete_id uuid not null,
  status     text not null default 'ok' check (status in ('ok', 'dns', 'dnf', 'dq')),
  place      int check (place >= 1),
  mark       text,
  records    text[] not null default '{}'
             check (records <@ array['pb', 'sb', 'nr', 'ar', 'wr']::text[]),
  primary key (event_id, athlete_id),
  foreign key (event_id, athlete_id) references entries(event_id, athlete_id) on delete cascade,
  -- A finisher has a mark; an athlete who did not finish has nothing but the status.
  check (case when status = 'ok' then mark is not null and btrim(mark) <> ''
              else place is null and mark is null and records = '{}' end)
);

-- Everybody reads the performances (they are public results); only the RPC below writes them.
alter table event_performances enable row level security;
create policy public_read on event_performances for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on event_performances from anon, authenticated;

alter table admin_actions drop constraint admin_actions_action_check;
alter table admin_actions add constraint admin_actions_action_check
  check (action in ('set_start_list', 'set_results', 'run_scoring', 'set_tolerance', 'edit_athlete',
                    'edit_competition', 'set_odds', 'set_rule', 'moderate_league',
                    'moderate_player', 'create_discipline', 'moderate_club', 'set_manager_rules',
                    'set_performances'));

-- Replaces every performance of an event in one transaction, and logs it. Lines:
-- [{athlete_id, status, place, mark, records}]. 42501 not an admin; 23503 an athlete is not on the
-- start list (foreign key); 23514 a line breaks the rules above.
create function admin_set_performances(p_event uuid, p_lines jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can enter performances' using errcode = '42501';
  end if;
  delete from event_performances where event_id = p_event;
  insert into event_performances (event_id, athlete_id, status, place, mark, records)
  select p_event, (l ->> 'athlete_id')::uuid, coalesce(l ->> 'status', 'ok'),
         (l ->> 'place')::int, nullif(l ->> 'mark', ''),
         array(select jsonb_array_elements_text(coalesce(l -> 'records', '[]'::jsonb)))
  from jsonb_array_elements(p_lines) as l;
  perform private.log_admin_action('set_performances', p_event, p_lines);
end $$;
revoke execute on function admin_set_performances(uuid, jsonb) from public, anon;
grant execute on function admin_set_performances(uuid, jsonb) to authenticated;

-- The athletes of the event's start list lined up by at least one participant of a Manager
-- league for its competition: their performances must not be missing. Lineups are private, so
-- only an admin reads this. 42501 not an admin.
create function admin_manager_lined_up(p_event uuid) returns setof uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can see the lineups' using errcode = '42501';
  end if;
  return query
    select distinct en.athlete_id
    from entries en
    join events e on e.id = en.event_id
    join manager_lineups l on l.competition_id = e.competition_id
    where en.event_id = p_event and en.athlete_id = any (l.athlete_ids);
end $$;
revoke execute on function admin_manager_lined_up(uuid) from public, anon;
grant execute on function admin_manager_lined_up(uuid) to authenticated;
