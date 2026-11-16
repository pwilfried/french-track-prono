-- French Track Manager (#1028): the back-office suggests a price from the athlete page. The page
-- gets the athlete's condition and how often they run in France; the grid and the factors of the
-- suggestion join the Manager rules. The rule itself is in src/domain/manager-price.ts.

alter table athletes
  add column manager_condition text not null default 'fit'
    check (manager_condition in ('fit', 'doubtful', 'out')),
  add column france_presence text not null default 'sometimes'
    check (france_presence in ('often', 'sometimes', 'rarely'));

-- Sets both at once, as the back-office form does, and logs it.
create function admin_set_athlete_manager_profile(p_athlete uuid, p_condition text,
                                                  p_presence text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'only an admin can edit an athlete' using errcode = '42501';
  end if;
  if p_condition is null or p_condition not in ('fit', 'doubtful', 'out')
     or p_presence is null or p_presence not in ('often', 'sometimes', 'rarely') then
    raise exception 'unknown condition or presence' using errcode = '22023';
  end if;
  update athletes set manager_condition = p_condition, france_presence = p_presence
  where id = p_athlete;
  perform private.log_admin_action('edit_athlete', null,
    jsonb_build_object('athlete', p_athlete, 'manager_condition', p_condition,
                       'france_presence', p_presence));
end $$;
revoke execute on function admin_set_athlete_manager_profile(uuid, text, text) from public, anon;
grant execute on function admin_set_athlete_manager_profile(uuid, text, text) to authenticated;

-- Values to start with (decision of 16 Nov. 2026, #1017); the owner adjusts them in the
-- back-office. The leagues already created get them too: they only serve the back-office.
update manager_rules set rules = rules || '{"pricing": {
  "grid": [{"minPoints": 1200, "price": 20}, {"minPoints": 1150, "price": 12},
           {"minPoints": 1100, "price": 7}, {"minPoints": 1050, "price": 4},
           {"minPoints": 0, "price": 2}],
  "oldMarkPenalty": 0.05, "unfitFactor": 0.5, "rarelyFactor": 0.6
}}'::jsonb
where not rules ? 'pricing';
update manager_leagues l
set rules = l.rules || (select jsonb_build_object('pricing', r.rules -> 'pricing')
                        from manager_rules r)
where not l.rules ? 'pricing';
