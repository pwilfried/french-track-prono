-- Start lists (v0.8): the admin enters who runs an event, with the admin's own session.
-- Everybody reads entries (existing policies); only an admin writes.
create policy admin_write on entries for all to authenticated
  using (is_admin()) with check (is_admin());

-- Replaces the start list of an event in one transaction. Athletes left out are removed, the
-- others are added or get their new season best. Removing an athlete already predicted fails on
-- the foreign key of predictions (23503); removing an athlete of the result would silently delete
-- the result line, so it fails explicitly with the same code.
-- Security invoker: row level security applies as well (admin_write policy).
create function set_start_list(p_event uuid, p_entries jsonb) returns void
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
end $$;

revoke execute on function set_start_list(uuid, jsonb) from public, anon;
grant execute on function set_start_list(uuid, jsonb) to authenticated;
