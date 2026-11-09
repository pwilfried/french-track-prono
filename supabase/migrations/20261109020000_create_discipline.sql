-- #292: the admin adds a discipline (60 m haies, mile, relais mixte…) from the back-office.

alter table admin_actions drop constraint admin_actions_action_check;
alter table admin_actions add constraint admin_actions_action_check
  check (action in ('set_start_list', 'set_results', 'run_scoring', 'set_tolerance', 'edit_athlete',
                    'edit_competition', 'set_odds', 'set_rule', 'moderate_league',
                    'moderate_player', 'create_discipline'));

create function create_discipline(
  p_name text, p_family text, p_unit text, p_lower_is_better boolean, p_tolerance numeric
) returns void
language plpgsql security definer set search_path = public as $$
declare v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if not is_admin() then
    raise exception 'only an admin creates a discipline' using errcode = '42501';
  end if;
  if length(v_name) not between 2 and 40 then
    raise exception 'invalid discipline name' using errcode = '22023';
  end if;
  if exists (select 1 from disciplines where lower(name) = lower(v_name)) then
    raise exception 'discipline already exists' using errcode = '23505';
  end if;
  -- The checks of the table refuse an unknown family or unit and a tolerance not above zero.
  insert into disciplines (name, family, unit, lower_is_better, tolerance)
  values (v_name, p_family, p_unit, p_lower_is_better, p_tolerance);
  perform private.log_admin_action('create_discipline', null,
    jsonb_build_object('discipline', v_name, 'family', p_family, 'unit', p_unit,
                       'tolerance', p_tolerance));
end $$;

revoke execute on function create_discipline(text, text, text, boolean, numeric) from public, anon;
grant execute on function create_discipline(text, text, text, boolean, numeric) to authenticated;
