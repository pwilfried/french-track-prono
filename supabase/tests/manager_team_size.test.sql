-- pgTAP: a Manager team has no maximum size, only a minimum (#607). A participant recruits while
-- their credits left pay the cheapest free athlete, past the former maximum of 12 athletes; the
-- mercato closes on spent budgets by that rule alone, and the complement does not touch a team
-- above the minimum. Rolled back at the end.
begin;
select plan(7);

-- Only the athletes of this test are in the catalogue.
update athletes set manager_price = null where manager_price is not null;

select ok((select rules ? 'minTeamSize' and not rules ? 'teamSize' from manager_rules),
  'the general rules hold a minimum team size and no maximum');

insert into auth.users (id, email) values
  ('a7c00000-0000-0000-0000-000000000001', 'one@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('a7c00000-0000-0000-0000-000000000001', 'Taille Une', now());

create function pg_temp.athlete(p_n int) returns uuid language sql immutable as $$
  select ('a7c00000-0000-0000-00a0-0000000000' || lpad(p_n::text, 2, '0'))::uuid
$$;
create function pg_temp.league() returns uuid language sql immutable as $$
  select 'a7c00000-0000-0000-0000-0000000000ff'::uuid
$$;
create function pg_temp.player() returns uuid language sql immutable as $$
  select 'a7c00000-0000-0000-0000-000000000001'::uuid
$$;
create function pg_temp.team_size() returns int language sql as $$
  select count(*)::int from manager_awards
  where league_id = pg_temp.league() and user_id = pg_temp.player()
$$;
create function pg_temp.closed() returns boolean language sql as $$
  select mercato_closed_at is not null from manager_leagues where id = pg_temp.league()
$$;

-- Fifteen women sprinters at 10 credits.
insert into athletes (id, slug, name, country_code, gender, manager_price)
select pg_temp.athlete(n), 'taille-' || n, 'Taille Athlete ' || n, 'FRA', 'F', 10
from generate_series(1, 15) as n;
insert into athlete_disciplines (athlete_id, discipline, is_primary)
select pg_temp.athlete(n), '100 m', true from generate_series(1, 15) as n;

insert into manager_leagues (id, name, owner_id, rules, mercato_opened_at)
values (pg_temp.league(), 'Sans maximum', pg_temp.player(),
  '{"budget": 200, "minTeamSize": 2,
    "quotas": [{"sex": "F", "family": "sprint", "min": 0, "max": 20}],
    "rounds": {"firstHours": 48, "longRounds": 2, "nextHours": 24},
    "closeModes": ["budgets_spent"]}', now() - interval '1 hour');
insert into manager_members (league_id, user_id) values (pg_temp.league(), pg_temp.player());

-- Round 1 gave the participant 13 athletes, past the former maximum of 12.
insert into manager_rounds (league_id, round, ends_at) values (pg_temp.league(), 1, now());
insert into manager_awards (league_id, athlete_id, user_id, amount, round)
select pg_temp.league(), pg_temp.athlete(n), pg_temp.player(), 10, 1
from generate_series(1, 13) as n;

select is(array(select private.manager_recruiters(pg_temp.league())), array[pg_temp.player()],
  'a team of 13 athletes still recruits while its credits pay a free athlete');

-- A bid in round 2 makes it 14.
insert into manager_bids (league_id, user_id, athlete_id, amount)
values (pg_temp.league(), pg_temp.player(), pg_temp.athlete(14), 10);
update manager_leagues set mercato_opened_at = now() - interval '97 hours'
where id = pg_temp.league();
select private.close_manager_rounds();
select is(pg_temp.team_size(), 14, 'a team goes past 12 athletes when the budget allows it');
select ok(not pg_temp.closed(), 'the mercato stays open while the credits pay a free athlete');

-- Less budget: 5 credits left, the cheapest free athlete costs 10.
update manager_leagues set rules = rules || '{"budget": 145}' where id = pg_temp.league();
select is(array(select private.manager_recruiters(pg_temp.league())), array[]::uuid[],
  'nobody recruits once the credits left pay no free athlete');
select private.close_manager_rounds();
select ok(pg_temp.closed(), 'the mercato closes once the budgets are spent');
select is(pg_temp.team_size(), 14, 'the complement gives nothing to a team above the minimum');

select * from finish();
rollback;
