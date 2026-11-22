-- A result entered before the lock locks the event at once (#1063). Otherwise the podium shows
-- while the predictions are still open and hidden, and a player could still predict knowing it.
-- Both writers of the official podium (set_results, admin_set_performances) move lock_at to now()
-- in the same transaction, and the admin log keeps a `lock_event` line with the lock time the
-- event had. An erased result locks nothing; an event already locked keeps its lock time.

alter table admin_actions drop constraint admin_actions_action_check;
alter table admin_actions add constraint admin_actions_action_check
  check (action in ('set_start_list', 'set_results', 'run_scoring', 'set_tolerance', 'edit_athlete',
                    'edit_competition', 'set_odds', 'set_rule', 'moderate_league',
                    'moderate_player', 'create_discipline', 'moderate_club', 'set_manager_rules',
                    'set_performances', 'run_manager_scoring', 'lock_event'));

-- Locks an event that has a result but whose lock has not passed yet, and logs it. Security
-- definer: an admin writes results, not events. Not in the API schema: only the RPCs below call it.
create function private.lock_event_on_result(p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_lock timestamptz;
begin
  if not is_admin() then
    raise exception 'only an admin can lock an event' using errcode = '42501';
  end if;
  select lock_at into v_lock from events where id = p_event for update;
  if v_lock is null or v_lock <= now()
     or not exists (select 1 from results where event_id = p_event) then
    return;
  end if;
  update events set lock_at = now() where id = p_event;
  perform private.log_admin_action('lock_event', p_event, jsonb_build_object('lock_at', v_lock));
end $$;
revoke execute on function private.lock_event_on_result(uuid) from public, anon, authenticated;
grant execute on function private.lock_event_on_result(uuid) to authenticated;

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
  perform private.lock_event_on_result(p_event);
end $$;

create or replace function admin_set_performances(p_event uuid, p_lines jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can enter performances' using errcode = '42501';
  end if;
  delete from event_performances where event_id = p_event;
  insert into event_performances (event_id, athlete_id, status, place, mark, records)
  select p_event, (l ->> 'athlete_id')::uuid, coalesce(l ->> 'status', 'ok'),
         (l ->> 'place')::int, nullif(btrim(l ->> 'mark'), ''),
         array(select jsonb_array_elements_text(coalesce(l -> 'records', '[]'::jsonb)))
  from jsonb_array_elements(p_lines) as l;
  -- The podium of the predictions, drawn from the sheet.
  delete from results where event_id = p_event;
  insert into results (event_id, athlete_id, rank, mark)
  select event_id, athlete_id, place, mark
  from event_performances
  where event_id = p_event and status = 'ok' and place between 1 and 3;
  perform private.log_admin_action('set_performances', p_event, p_lines);
  perform private.lock_event_on_result(p_event);
end $$;
