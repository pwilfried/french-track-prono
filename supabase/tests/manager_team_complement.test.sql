-- pgTAP: completing the teams at the close of the mercato (#425). An incomplete team receives free
-- athletes at random, within its quotas and its credits left, at the reference price, until it is
-- complete, its credits are spent or no free athlete fits. Then each team is checked against the
-- minimum quotas. The draw follows setseed().
--   f1 the team becomes complete;     f2 the credits run out;
--   f3 no athlete fits, non-compliant; f4 a complete team gets nothing;
--   f5 and f6 the same league twice, with the same seed.
-- Rolled back at the end.
begin;
select plan(17);

-- Only the athletes of this test are in the catalogue.
update athletes set manager_price = null where manager_price is not null;

insert into auth.users (id, email) values
  ('a5c00000-0000-0000-0000-000000000001', 'one@example.test'),
  ('a5c00000-0000-0000-0000-000000000002', 'two@example.test'),
  ('a5c00000-0000-0000-0000-000000000003', 'three@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('a5c00000-0000-0000-0000-000000000001', 'Comp Une', now()),
  ('a5c00000-0000-0000-0000-000000000002', 'Comp Deux', now()),
  ('a5c00000-0000-0000-0000-000000000003', 'Comp Trois', now());

create function pg_temp.athlete(p_n int) returns uuid language sql immutable as $$
  select ('a5c00000-0000-0000-0000-0000000000a' || p_n)::uuid
$$;
create function pg_temp.league(p_n int) returns uuid language sql immutable as $$
  select ('a5c00000-0000-0000-0000-0000000000f' || p_n)::uuid
$$;
create function pg_temp.player(p_n int) returns uuid language sql immutable as $$
  select ('a5c00000-0000-0000-0000-00000000000' || p_n)::uuid
$$;

insert into athletes (id, slug, name, country_code, gender, manager_price)
select pg_temp.athlete(n), 'comp-' || n, 'Comp Athlete ' || n, 'FRA', sex, price
from (values (1, 'F', 10), (2, 'F', 10), (3, 'F', 10), (4, 'M', 10),
             (5, 'F', 20), (6, 'F', 20), (7, 'M', 50), (8, 'F', 5)) as t(n, sex, price);
insert into athlete_disciplines (athlete_id, discipline, is_primary)
select pg_temp.athlete(n), discipline, true
from (values (1, '100 m'), (2, '200 m'), (3, '400 m'), (4, '100 m'), (5, '800 m'),
             (6, '1500 m'), (7, 'Lancer du poids'), (8, '5000 m')) as t(n, discipline);

-- Women sprinters: 1 to 2; men sprinters: up to 1; women middle distance: up to 2; men throwers:
-- up to 1. No quota for long distance: athlete 8 is never given.
create function pg_temp.rules(p_budget int, p_size int) returns jsonb language sql immutable as $$
  select jsonb_build_object('budget', p_budget, 'teamSize', p_size,
    'rounds', '{"firstHours": 48, "longRounds": 2, "nextHours": 24}'::jsonb,
    'closeModes', '["last_bidder"]'::jsonb,
    'quotas', '[{"sex": "F", "family": "sprint", "min": 1, "max": 2},
                {"sex": "M", "family": "sprint", "min": 0, "max": 1},
                {"sex": "F", "family": "middle", "min": 0, "max": 2},
                {"sex": "M", "family": "throws", "min": 0, "max": 1}]'::jsonb)
$$;
insert into manager_leagues (id, name, owner_id, rules, mercato_opened_at)
select pg_temp.league(n), 'Complement ' || n, pg_temp.player(1), rules, now() - interval '1 hour'
from (values (1, pg_temp.rules(100, 4)),
             (2, pg_temp.rules(30, 12)),
             (3, pg_temp.rules(100, 12)
                 || '{"quotas": [{"sex": "F", "family": "middle", "min": 3, "max": 3}]}'),
             (4, pg_temp.rules(100, 1)),
             (5, pg_temp.rules(100, 3)),
             (6, pg_temp.rules(100, 3))) as t(n, rules);
insert into manager_members (league_id, user_id)
select pg_temp.league(l), pg_temp.player(p)
from (values (1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (5, 2), (5, 3), (6, 1), (6, 2), (6, 3))
  as t(l, p);
-- In f1 and f4, one already won athlete 1 in round 1.
insert into manager_rounds (league_id, round, ends_at)
values (pg_temp.league(1), 1, now()), (pg_temp.league(4), 1, now());
insert into manager_awards (league_id, athlete_id, user_id, amount, round)
values (pg_temp.league(1), pg_temp.athlete(1), pg_temp.player(1), 10, 1),
       (pg_temp.league(4), pg_temp.athlete(1), pg_temp.player(1), 10, 1);

create function pg_temp.team(p_league int, p_player int) returns setof uuid language sql as $$
  select athlete_id from manager_awards
  where league_id = pg_temp.league(p_league) and user_id = pg_temp.player(p_player)
$$;
create function pg_temp.compliant(p_league int, p_player int) returns boolean language sql as $$
  select team_compliant from manager_members
  where league_id = pg_temp.league(p_league) and user_id = pg_temp.player(p_player)
$$;

select is(pg_temp.compliant(1, 1), null, 'a team is neither valid nor non-compliant before the close');

-- 1. The team becomes complete.
select setseed(0.1);
select private.finish_manager_mercato(pg_temp.league(1));
select is((select count(*)::int from pg_temp.team(1, 1)), 4,
  'an incomplete team is completed up to the size of a team');
select ok(not exists (
    select 1
    from jsonb_array_elements(pg_temp.rules(100, 4) -> 'quotas') q
    where (select count(*) from private.manager_team(pg_temp.league(1), pg_temp.player(1)) t
           where t.sex = q ->> 'sex' and t.family = q ->> 'family') > (q ->> 'max')::int),
  'within the maximum of each quota');
select ok(pg_temp.athlete(8) not in (select pg_temp.team(1, 1)),
  'never in a family without a quota');
select is((select count(*)::int from manager_awards w join athletes a on a.id = w.athlete_id
           where w.league_id = pg_temp.league(1) and w.amount <> a.manager_price), 0,
  'each athlete given costs their reference price');
select is((select array_agg(distinct round) from manager_awards
           where league_id = pg_temp.league(1) and athlete_id <> pg_temp.athlete(1)), array[2],
  'the athletes given make a last round');
select is(pg_temp.compliant(1, 1), true, 'a team within the minimum quotas is valid');

-- 2. The credits run out.
select private.finish_manager_mercato(pg_temp.league(2));
select ok(private.manager_spent(pg_temp.league(2), pg_temp.player(1)) between 10 and 30,
  'athletes are given within the credits left');
select ok(not exists (select 1 from private.manager_complement_candidates(pg_temp.league(2),
                                                                          pg_temp.player(1))),
  'until no free athlete is affordable');

-- 3. No athlete fits: the team stays incomplete and is non-compliant.
select private.finish_manager_mercato(pg_temp.league(3));
select set_eq($$select pg_temp.team(3, 1)$$,
  array[pg_temp.athlete(5), pg_temp.athlete(6)],
  'every free athlete that fits a quota is given');
select is(pg_temp.compliant(3, 1), false, 'a team under a minimum quota is non-compliant');

-- 4. A complete team gets nothing, and no round is added.
select private.finish_manager_mercato(pg_temp.league(4));
select set_eq($$select pg_temp.team(4, 1)$$, array[pg_temp.athlete(1)],
  'a complete team gets no athlete');
select is((select count(*)::int from manager_rounds where league_id = pg_temp.league(4)), 1,
  'and the close adds no round when nobody is given an athlete');
select ok((select mercato_closed_at is not null from manager_leagues
           where id = pg_temp.league(4)), 'the mercato is closed');

-- 5. The same league twice with the same seed: the same draw.
select setseed(0.42);
select private.finish_manager_mercato(pg_temp.league(5));
select setseed(0.42);
select private.finish_manager_mercato(pg_temp.league(6));
select results_eq(
  $$select user_id, athlete_id from manager_awards where league_id = pg_temp.league(5)
    order by user_id, athlete_id$$,
  $$select user_id, athlete_id from manager_awards where league_id = pg_temp.league(6)
    order by user_id, athlete_id$$,
  'the same seed gives the same athletes to the same teams');
select is((select count(*)::int from manager_awards where league_id = pg_temp.league(5)), 7,
  'the free athletes that fit are shared out');
select ok(not exists (select 1 from manager_members
                      where league_id = pg_temp.league(5) and team_compliant is null),
  'every team is checked at the close');

select * from finish();
rollback;
