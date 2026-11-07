-- Replaces the prediction points of an event in one transaction (delete + insert): computing
-- again after a corrected result never duplicates a line (S12). Admin only.
create function set_event_scores(p_event uuid, p_lines jsonb) returns void
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
end $$;

revoke execute on function set_event_scores(uuid, jsonb) from public, anon;
grant execute on function set_event_scores(uuid, jsonb) to authenticated;
