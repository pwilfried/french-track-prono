-- #366: the admin creates, edits, validates and deletes clubs from the back-office.

alter table clubs drop constraint clubs_source_check;
alter table clubs add constraint clubs_source_check check (source in ('import', 'player', 'admin'));
-- A club the admin edited keeps its name and town when the monthly import runs again.
alter table clubs add column edited boolean not null default false;

create or replace function import_clubs(p_clubs jsonb) returns int
language plpgsql set search_path = public as $$
declare
  v_count int;
begin
  insert into clubs (name, city, department, siren, source, validated)
  select c->>'name', coalesce(c->>'city', ''), coalesce(c->>'department', ''), c->>'siren', 'import', true
  from jsonb_array_elements(p_clubs) c
  on conflict (siren) do update
    set name = excluded.name, city = excluded.city, department = excluded.department
    where not clubs.edited;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke execute on function import_clubs(jsonb) from public, anon, authenticated;

alter table admin_actions drop constraint admin_actions_action_check;
alter table admin_actions add constraint admin_actions_action_check
  check (action in ('set_start_list', 'set_results', 'run_scoring', 'set_tolerance', 'edit_athlete',
                    'edit_competition', 'set_odds', 'set_rule', 'moderate_league',
                    'moderate_player', 'create_discipline', 'moderate_club'));

-- Clubs whose name or town contains the query (all of them when empty), those to validate first.
create function admin_list_clubs(p_query text, p_pending_only boolean default false)
returns table (id uuid, name text, city text, department text, source text, validated boolean,
               player_count bigint)
language plpgsql stable security definer set search_path = public as $$
declare v_key text := club_search_key(coalesce(p_query, ''));
begin
  if not is_admin() then
    raise exception 'only an admin manages clubs' using errcode = '42501';
  end if;
  return query
  select c.id, c.name, c.city, c.department, c.source, c.validated,
         (select count(*) from profiles p where p.club_id = c.id)
  from clubs c
  where (not p_pending_only or not c.validated)
    and (v_key = '' or c.search_key like '%' || v_key || '%')
  order by c.validated, c.name
  limit 50;
end $$;

-- Creates (p_club null) or edits a club; the admin's clubs are validated.
create function admin_save_club(p_club uuid, p_name text, p_city text, p_department text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_city text := regexp_replace(trim(coalesce(p_city, '')), '\s+', ' ', 'g');
  v_id uuid;
begin
  if not is_admin() then
    raise exception 'only an admin manages clubs' using errcode = '42501';
  end if;
  if length(v_name) not between 2 and 120 or length(v_city) > 80 then
    raise exception 'invalid club name' using errcode = '22023';
  end if;
  if is_banned_name(v_name) or is_banned_name(v_city) then
    raise exception 'banned name' using errcode = 'FT013';
  end if;
  if p_club is null then
    insert into clubs (name, city, department, source, validated, edited)
    values (v_name, v_city, coalesce(trim(p_department), ''), 'admin', true, true)
    returning id into v_id;
  else
    update clubs set name = v_name, city = v_city, department = coalesce(trim(p_department), ''),
                     edited = true
    where id = p_club returning id into v_id;
    if v_id is null then
      raise exception 'unknown club' using errcode = 'P0002';
    end if;
  end if;
  perform private.log_admin_action('moderate_club', null,
    jsonb_build_object('club', v_id, 'name', v_name, 'action', case when p_club is null then 'create' else 'edit' end));
  return v_id;
end $$;

create function admin_validate_club(p_club uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if not is_admin() then
    raise exception 'only an admin manages clubs' using errcode = '42501';
  end if;
  update clubs set validated = true where id = p_club returning name into v_name;
  if v_name is null then
    raise exception 'unknown club' using errcode = 'P0002';
  end if;
  perform private.log_admin_action('moderate_club', null,
    jsonb_build_object('club', p_club, 'name', v_name, 'action', 'validate'));
end $$;

-- The players of a deleted club simply have no club any more (club_id set null).
create function admin_delete_club(p_club uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if not is_admin() then
    raise exception 'only an admin manages clubs' using errcode = '42501';
  end if;
  delete from clubs where id = p_club returning name into v_name;
  if v_name is null then
    raise exception 'unknown club' using errcode = 'P0002';
  end if;
  perform private.log_admin_action('moderate_club', null,
    jsonb_build_object('club', p_club, 'name', v_name, 'action', 'delete'));
end $$;

revoke execute on function admin_list_clubs(text, boolean) from public, anon;
revoke execute on function admin_save_club(uuid, text, text, text) from public, anon;
revoke execute on function admin_validate_club(uuid) from public, anon;
revoke execute on function admin_delete_club(uuid) from public, anon;
grant execute on function admin_list_clubs(text, boolean) to authenticated;
grant execute on function admin_save_club(uuid, text, text, text) to authenticated;
grant execute on function admin_validate_club(uuid) to authenticated;
grant execute on function admin_delete_club(uuid) to authenticated;
