-- #1070: when the admin moves a competition, its events can move with it (« Décaler aussi les
-- épreuves »). Each event moves by whole days and keeps its Paris time (summer time included);
-- its lock moves the same way, so the lock stays as long before the start. Error codes: 42501
-- not admin, FT004 unknown competition.

create function admin_shift_competition_events(p_slug text, p_days integer)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_competition uuid;
  v_moved integer;
begin
  if not is_admin() then
    raise exception 'only an admin can move events' using errcode = '42501';
  end if;
  select id into v_competition from competitions where slug = p_slug;
  if v_competition is null then
    raise exception 'unknown competition' using errcode = 'FT004';
  end if;
  update events
  set starts_at = ((starts_at at time zone 'Europe/Paris') + make_interval(days => p_days)) at time zone 'Europe/Paris',
      lock_at = ((lock_at at time zone 'Europe/Paris') + make_interval(days => p_days)) at time zone 'Europe/Paris'
  where competition_id = v_competition;
  get diagnostics v_moved = row_count;
  perform private.log_admin_action('edit_competition', null,
    jsonb_build_object('competition', p_slug, 'shifted_days', p_days, 'events', v_moved));
  return v_moved;
end $$;

revoke execute on function admin_shift_competition_events(text, integer) from public, anon;
grant execute on function admin_shift_competition_events(text, integer) to authenticated, service_role;
