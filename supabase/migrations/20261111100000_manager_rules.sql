-- French Track Manager, v0.12 (#418): the general rules, set by the admin of French Track Prono
-- only. One document (src/domain/manager-rules.ts, checked by the app before it is written) and
-- the competitions the seasons are played on. A league copies both when it is created (#419).
-- Error codes: 42501 not an admin, 22023 rules that are not a document with a budget,
-- P0002 unknown competition.

create table manager_rules (
  -- A single row.
  id         boolean primary key default true check (id),
  rules      jsonb not null check (jsonb_typeof(rules) = 'object'),
  updated_at timestamptz not null default now()
);

-- Values to start with; the owner adjusts them in the back-office.
insert into manager_rules (rules) values ('{
  "budget": 100,
  "teamSize": 12,
  "quotas": [
    {"sex": "F", "family": "sprint", "min": 1, "max": 3},
    {"sex": "M", "family": "sprint", "min": 1, "max": 3},
    {"sex": "F", "family": "hurdles", "min": 0, "max": 2},
    {"sex": "M", "family": "hurdles", "min": 0, "max": 2},
    {"sex": "F", "family": "middle", "min": 1, "max": 3},
    {"sex": "M", "family": "middle", "min": 1, "max": 3},
    {"sex": "F", "family": "long", "min": 0, "max": 2},
    {"sex": "M", "family": "long", "min": 0, "max": 2},
    {"sex": "F", "family": "horizontal_jumps", "min": 0, "max": 2},
    {"sex": "M", "family": "horizontal_jumps", "min": 0, "max": 2},
    {"sex": "F", "family": "vertical_jumps", "min": 0, "max": 2},
    {"sex": "M", "family": "vertical_jumps", "min": 0, "max": 2},
    {"sex": "F", "family": "throws", "min": 1, "max": 3},
    {"sex": "M", "family": "throws", "min": 1, "max": 3}
  ],
  "lineup": {"max": 8, "minPerFamily": {"sprint": 1, "middle": 1, "throws": 1}},
  "rounds": {"firstHours": 48, "longRounds": 2, "nextHours": 24},
  "closeModes": ["budgets_spent", "last_bidder", "scheduled"],
  "bonuses": {"first": 10, "second": 6, "third": 3, "personal_best": 5, "season_best": 3,
              "national_record": 10, "area_record": 15, "world_record": 25},
  "season": {"startsOn": "2027-01-01", "endsOn": "2027-12-31"}
}');

create table manager_competitions (
  competition_id uuid primary key references competitions(id) on delete cascade
);

alter table manager_rules enable row level security;
alter table manager_competitions enable row level security;
create policy read_signed_in on manager_rules for select to authenticated using (true);
create policy read_signed_in on manager_competitions for select to authenticated using (true);
revoke insert, update, delete, truncate on manager_rules, manager_competitions from anon, authenticated;

alter table admin_actions drop constraint admin_actions_action_check;
alter table admin_actions add constraint admin_actions_action_check
  check (action in ('set_start_list', 'set_results', 'run_scoring', 'set_tolerance', 'edit_athlete',
                    'edit_competition', 'set_odds', 'set_rule', 'moderate_league',
                    'moderate_player', 'create_discipline', 'moderate_club', 'set_manager_rules'));

-- Replaces the rules and the eligible competitions at once, and logs it.
create function admin_set_manager_rules(p_rules jsonb, p_competition_slugs text[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_wanted int := coalesce((select count(distinct s) from unnest(p_competition_slugs) s), 0);
begin
  if not is_admin() then
    raise exception 'only an admin sets the Manager rules' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rules) is distinct from 'object'
     or jsonb_typeof(p_rules -> 'budget') is distinct from 'number'
     or (p_rules ->> 'budget')::numeric <= 0 then
    raise exception 'invalid Manager rules' using errcode = '22023';
  end if;
  if (select count(*) from competitions where slug = any(p_competition_slugs)) <> v_wanted then
    raise exception 'unknown competition' using errcode = 'P0002';
  end if;
  update manager_rules set rules = p_rules, updated_at = now() where id;
  delete from manager_competitions where true;
  insert into manager_competitions (competition_id)
  select id from competitions where slug = any(p_competition_slugs);
  perform private.log_admin_action('set_manager_rules', null,
    jsonb_build_object('rules', p_rules, 'competitions', to_jsonb(p_competition_slugs)));
end $$;

revoke execute on function admin_set_manager_rules(jsonb, text[]) from public, anon;
grant execute on function admin_set_manager_rules(jsonb, text[]) to authenticated;
