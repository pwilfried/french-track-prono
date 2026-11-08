-- v0.7 (#321): moderation of public leagues, option 2 decided by the owner. A player reports a
-- public league once; the admin sees the reported leagues and renames or deletes them (logged).
-- Error codes: 42501 not signed in / not admin, P0002 unknown public league, FT010 banned name,
-- 22023 invalid name.

create table league_reports (
  league_id  uuid not null references leagues(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
alter table league_reports enable row level security;
-- A player sees only his own reports; writes go through the functions below.
create policy own_reports on league_reports for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete, truncate on league_reports from anon, authenticated;

alter table admin_actions drop constraint admin_actions_action_check;
alter table admin_actions add constraint admin_actions_action_check
  check (action in ('set_start_list', 'set_results', 'run_scoring', 'set_tolerance', 'edit_athlete',
                    'edit_competition', 'set_odds', 'set_rule', 'moderate_league'));

-- A player reports a public league; reporting twice changes nothing.
create function report_league(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if not exists (select 1 from leagues where id = p_league and is_public) then
    raise exception 'unknown public league' using errcode = 'P0002';
  end if;
  insert into league_reports (league_id, user_id) values (p_league, auth.uid())
  on conflict do nothing;
end $$;
revoke execute on function report_league(uuid) from public, anon;
grant execute on function report_league(uuid) to authenticated;

-- The reported leagues, the most reported first (admin only).
create function admin_list_reported_leagues()
returns table (league_id uuid, name text, report_count bigint, member_count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin sees the reports' using errcode = '42501';
  end if;
  return query
    select l.id, l.name, count(distinct r.user_id),
           (select count(*) from league_members m where m.league_id = l.id)
    from leagues l join league_reports r on r.league_id = l.id
    group by l.id, l.name
    order by count(distinct r.user_id) desc, l.name;
end $$;
revoke execute on function admin_list_reported_leagues() from public, anon;
grant execute on function admin_list_reported_leagues() to authenticated;

-- The admin renames a reported league: its reports are cleared.
create function admin_rename_league(p_league uuid, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  if not is_admin() then
    raise exception 'only an admin renames a league' using errcode = '42501';
  end if;
  select name into v_old from leagues where id = p_league;
  if v_old is null then
    raise exception 'unknown league' using errcode = 'P0002';
  end if;
  if char_length(trim(p_name)) not between 2 and 40 then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  if is_banned_league_name(p_name) then
    raise exception 'banned name' using errcode = 'FT010';
  end if;
  update leagues set name = trim(p_name) where id = p_league;
  delete from league_reports where league_id = p_league;
  perform private.log_admin_action('moderate_league', null,
    jsonb_build_object('league', p_league, 'renamed_from', v_old, 'renamed_to', trim(p_name)));
end $$;
revoke execute on function admin_rename_league(uuid, text) from public, anon;
grant execute on function admin_rename_league(uuid, text) to authenticated;

-- The admin deletes a league (members, competitions and reports go with it).
create function admin_delete_league(p_league uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if not is_admin() then
    raise exception 'only an admin deletes a league' using errcode = '42501';
  end if;
  select name into v_name from leagues where id = p_league;
  if v_name is null then
    raise exception 'unknown league' using errcode = 'P0002';
  end if;
  delete from leagues where id = p_league;
  perform private.log_admin_action('moderate_league', null,
    jsonb_build_object('league', p_league, 'deleted', v_name));
end $$;
revoke execute on function admin_delete_league(uuid) from public, anon;
grant execute on function admin_delete_league(uuid) to authenticated;
