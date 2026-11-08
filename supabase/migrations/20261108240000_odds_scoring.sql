-- Scoring with odds and marks (v0.9, #262), on top of the current scale. The new values are rows
-- of scoring_rules the admin can change from /admin/bareme; a change applies to the points
-- computed afterwards.
insert into scoring_rules (key, value, description) values
  ('odds_exact',   3, 'Multiplicateur de la cote : athlète à la bonne place'),
  ('odds_one_off', 2, 'Multiplicateur de la cote : une place d''écart'),
  ('odds_two_off', 1, 'Multiplicateur de la cote : deux places d''écart'),
  ('mark_exact',   5, 'Perf juste : dans la tolérance de la discipline'),
  ('mark_near',    2, 'Perf proche : dans le double de la tolérance')
on conflict (key) do nothing;

alter table admin_actions drop constraint admin_actions_action_check;
alter table admin_actions add constraint admin_actions_action_check
  check (action in ('set_start_list', 'set_results', 'run_scoring', 'set_tolerance', 'edit_athlete',
                    'edit_competition', 'set_odds', 'set_rule'));

-- The admin changes one value of the scale. 42501 not admin, FT007 unknown key, 22023 not positive
-- (the flair threshold is a share: at most 1).
create function admin_set_scoring_rule(p_key text, p_value numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can change the scale' using errcode = '42501';
  end if;
  if p_value is null or p_value <= 0 or (p_key = 'flair_threshold' and p_value > 1) then
    raise exception 'invalid value' using errcode = '22023';
  end if;
  update scoring_rules set value = p_value where key = p_key;
  if not found then
    raise exception 'unknown rule' using errcode = 'FT007';
  end if;
  perform private.log_admin_action('set_rule', null, jsonb_build_object('rule', p_key, 'value', p_value));
end $$;

revoke execute on function admin_set_scoring_rule(text, numeric) from public, anon;
grant execute on function admin_set_scoring_rule(text, numeric) to authenticated;
