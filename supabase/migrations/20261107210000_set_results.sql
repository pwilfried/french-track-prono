-- Replaces the official result of an event in one transaction (delete + insert).
-- Security invoker: row level security applies as well (admin_write policy).
create function set_results(p_event uuid, p_lines jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  -- Explicit check: with an empty list, row level security alone would let the call succeed.
  if not is_admin() then
    raise exception 'only an admin can enter results' using errcode = '42501';
  end if;
  delete from results where event_id = p_event;
  insert into results (event_id, athlete_id, rank, mark)
  select p_event, (l ->> 'athlete_id')::uuid, (l ->> 'rank')::int, nullif(l ->> 'mark', '')
  from jsonb_array_elements(p_lines) as l;
end $$;

revoke execute on function set_results(uuid, jsonb) from public, anon;
grant execute on function set_results(uuid, jsonb) to authenticated;
