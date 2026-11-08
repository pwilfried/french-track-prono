-- Athletes in the back-office (v0.9): the admin edits an athlete, their disciplines (one main) and
-- their PR and SB per discipline. Every write goes through these functions (admin only, logged).
alter table admin_actions drop constraint admin_actions_action_check;
alter table admin_actions add constraint admin_actions_action_check
  check (action in ('set_start_list', 'set_results', 'run_scoring', 'set_tolerance', 'edit_athlete'));

create function admin_update_athlete(p_athlete uuid, p_name text, p_country text, p_gender text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can edit an athlete' using errcode = '42501';
  end if;
  update athletes set name = p_name, country_code = upper(p_country), gender = p_gender
  where id = p_athlete;
  perform private.log_admin_action('edit_athlete', null,
    jsonb_build_object('athlete', p_athlete, 'name', p_name, 'country', upper(p_country), 'gender', p_gender));
end $$;

-- Adds a discipline (or changes whether it is the main one). One main discipline per athlete.
create function admin_set_athlete_discipline(p_athlete uuid, p_discipline text, p_primary boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can edit an athlete' using errcode = '42501';
  end if;
  if p_primary then
    update athlete_disciplines set is_primary = false where athlete_id = p_athlete;
  end if;
  insert into athlete_disciplines (athlete_id, discipline, is_primary)
  values (p_athlete, p_discipline, p_primary)
  on conflict (athlete_id, discipline) do update set is_primary = excluded.is_primary;
  perform private.log_admin_action('edit_athlete', null,
    jsonb_build_object('athlete', p_athlete, 'discipline', p_discipline, 'primary', p_primary));
end $$;

create function admin_remove_athlete_discipline(p_athlete uuid, p_discipline text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can edit an athlete' using errcode = '42501';
  end if;
  delete from athlete_disciplines where athlete_id = p_athlete and discipline = p_discipline;
  perform private.log_admin_action('edit_athlete', null,
    jsonb_build_object('athlete', p_athlete, 'removed', p_discipline));
end $$;

-- Sets a PR or an SB typed by the admin (marked verified); an empty mark removes it. The value is
-- read by the app from the mark, in the unit of the discipline.
create function admin_set_athlete_record(
  p_athlete uuid, p_discipline text, p_kind text, p_mark text, p_value numeric, p_date date
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can edit an athlete' using errcode = '42501';
  end if;
  if p_kind not in ('pr', 'sb') then
    raise exception 'only PR and SB are entered here' using errcode = '22023';
  end if;
  if p_mark is null or p_mark = '' then
    delete from athlete_records where athlete_id = p_athlete and discipline = p_discipline and kind = p_kind;
  else
    insert into athlete_records (athlete_id, discipline, kind, mark, mark_value, record_date, verified)
    values (p_athlete, p_discipline, p_kind, p_mark, p_value, p_date, true)
    on conflict (athlete_id, discipline, kind) do update
      set mark = excluded.mark, mark_value = excluded.mark_value,
          record_date = excluded.record_date, meeting_name = null, verified = true;
  end if;
  perform private.log_admin_action('edit_athlete', null,
    jsonb_build_object('athlete', p_athlete, 'discipline', p_discipline, 'kind', p_kind, 'mark', p_mark));
end $$;

revoke execute on function admin_update_athlete(uuid, text, text, text) from public, anon;
revoke execute on function admin_set_athlete_discipline(uuid, text, boolean) from public, anon;
revoke execute on function admin_remove_athlete_discipline(uuid, text) from public, anon;
revoke execute on function admin_set_athlete_record(uuid, text, text, text, numeric, date) from public, anon;
grant execute on function admin_update_athlete(uuid, text, text, text) to authenticated;
grant execute on function admin_set_athlete_discipline(uuid, text, boolean) to authenticated;
grant execute on function admin_remove_athlete_discipline(uuid, text) to authenticated;
grant execute on function admin_set_athlete_record(uuid, text, text, text, numeric, date) to authenticated;
