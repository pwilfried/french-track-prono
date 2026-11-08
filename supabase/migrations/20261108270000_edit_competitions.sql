-- Corrections in the back-office (#293): the admin edits a competition and its events, and
-- deletes a mistake as long as nobody predicted it. Error codes: 42501 not admin, FT004 unknown
-- competition or event, FT008 already predicted. Deletions are logged without an event id (the
-- event is gone; its own log lines go with it).

create function admin_update_competition(
  p_slug text, p_name text, p_scope text, p_city text, p_country text,
  p_starts_on date, p_ends_on date, p_time_zone text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can edit a competition' using errcode = '42501';
  end if;
  update competitions
  set name = p_name, scope = p_scope, city = nullif(p_city, ''), country_code = nullif(upper(p_country), ''),
      starts_on = p_starts_on, ends_on = p_ends_on, time_zone = p_time_zone
  where slug = p_slug;
  if not found then
    raise exception 'unknown competition' using errcode = 'FT004';
  end if;
  perform private.log_admin_action('edit_competition', null,
    jsonb_build_object('competition', p_slug, 'name', p_name, 'edited', true));
end $$;

create function admin_delete_competition(p_slug text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_competition uuid;
begin
  if not is_admin() then
    raise exception 'only an admin can delete a competition' using errcode = '42501';
  end if;
  select id into v_competition from competitions where slug = p_slug;
  if v_competition is null then
    raise exception 'unknown competition' using errcode = 'FT004';
  end if;
  if exists (select 1 from predictions where competition_id = v_competition) then
    raise exception 'the competition was predicted' using errcode = 'FT008';
  end if;
  delete from competitions where id = v_competition;
  perform private.log_admin_action('edit_competition', null,
    jsonb_build_object('competition', p_slug, 'deleted', true));
end $$;

-- Moves an event or changes its round; the round stays once someone predicted the event.
create function admin_update_event(
  p_slug text, p_round text, p_starts_at timestamptz, p_lock_at timestamptz
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_event uuid;
  v_round text;
begin
  if not is_admin() then
    raise exception 'only an admin can edit an event' using errcode = '42501';
  end if;
  select id, round into v_event, v_round from events where slug = p_slug;
  if v_event is null then
    raise exception 'unknown event' using errcode = 'FT004';
  end if;
  if p_round <> v_round and exists (select 1 from predictions where event_id = v_event) then
    raise exception 'the event was predicted' using errcode = 'FT008';
  end if;
  update events set round = p_round, starts_at = p_starts_at, lock_at = p_lock_at where id = v_event;
  perform private.log_admin_action('edit_competition', v_event,
    jsonb_build_object('event', p_slug, 'round', p_round, 'starts_at', p_starts_at, 'lock_at', p_lock_at));
end $$;

create function admin_delete_event(p_slug text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_event uuid;
begin
  if not is_admin() then
    raise exception 'only an admin can delete an event' using errcode = '42501';
  end if;
  select id into v_event from events where slug = p_slug;
  if v_event is null then
    raise exception 'unknown event' using errcode = 'FT004';
  end if;
  if exists (select 1 from predictions where event_id = v_event) then
    raise exception 'the event was predicted' using errcode = 'FT008';
  end if;
  delete from events where id = v_event;
  perform private.log_admin_action('edit_competition', null,
    jsonb_build_object('event', p_slug, 'deleted', true));
end $$;

revoke execute on function admin_update_competition(text, text, text, text, text, date, date, text) from public, anon;
revoke execute on function admin_delete_competition(text) from public, anon;
revoke execute on function admin_update_event(text, text, timestamptz, timestamptz) from public, anon;
revoke execute on function admin_delete_event(text) from public, anon;
grant execute on function admin_update_competition(text, text, text, text, text, date, date, text) to authenticated;
grant execute on function admin_delete_competition(text) to authenticated;
grant execute on function admin_update_event(text, text, timestamptz, timestamptz) to authenticated;
grant execute on function admin_delete_event(text) to authenticated;
