-- The result sheet flags the bench substitutes too (#1053): since the match sheet (#1032, #1033)
-- a substitute may count for a place (the starter DNS, DNF or DQ, or a tactical change), so their
-- performance must not be missing either. The reserve (the rest of the team, off the sheet) is
-- not flagged. 42501 not an admin.
create or replace function admin_manager_lined_up(p_event uuid) returns setof uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can see the lineups' using errcode = '42501';
  end if;
  return query
    select en.athlete_id
    from entries en
    join events e on e.id = en.event_id
    join manager_lineups l on l.competition_id = e.competition_id
    where en.event_id = p_event and en.athlete_id = any (l.athlete_ids)
    union
    select en.athlete_id
    from entries en
    join events e on e.id = en.event_id
    join manager_lineup_entries le
      on le.competition_id = e.competition_id and le.athlete_id = en.athlete_id
    where en.event_id = p_event and le.role = 'substitute';
end $$;
revoke execute on function admin_manager_lined_up(uuid) from public, anon;
grant execute on function admin_manager_lined_up(uuid) to authenticated;
