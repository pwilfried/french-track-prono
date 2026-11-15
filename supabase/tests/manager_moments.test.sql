-- pgTAP: the feed of a Manager league and the badge moments (#875). A participant reads the
-- athletes won at each reveal, the duels once scored and the badges of the league; someone
-- outside reads nothing. Nobody writes a moment directly; a player publishes only a badge level
-- they hold, under its own key, once.
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(12);

insert into auth.users (id, email) values
  ('f8750000-0000-0000-0000-000000000001', 'home@example.test'),
  ('f8750000-0000-0000-0000-000000000002', 'away@example.test'),
  ('f8750000-0000-0000-0000-000000000003', 'outsider@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('f8750000-0000-0000-0000-000000000001', 'Maison875', now()),
  ('f8750000-0000-0000-0000-000000000002', 'Visite875', now()),
  ('f8750000-0000-0000-0000-000000000003', 'Dehors875', now());
insert into competitions (slug, name, starts_on, ends_on)
values ('test-manager-moments', 'Meeting 875', current_date + 10, current_date + 11);
insert into athletes (slug, name, country_code, gender)
values ('athlete-875', 'Athlète 875', 'FRA', 'F');

create temp table ctx (league uuid, manager uuid, competition uuid, athlete uuid);
grant all on ctx to authenticated;
insert into ctx (competition, athlete)
select c.id, a.id from competitions c, athletes a
where c.slug = 'test-manager-moments' and a.slug = 'athlete-875';

-- A Manager league of two; round 1 closed, the home player won the athlete for 35.
with l as (
  insert into manager_leagues (name, owner_id, rules, competition_ids)
  select 'Manager 875', 'f8750000-0000-0000-0000-000000000001', '{}', array[competition] from ctx
  returning id
)
update ctx set manager = (select id from l);
insert into manager_members (league_id, user_id)
select manager, u from ctx, unnest(array['f8750000-0000-0000-0000-000000000001',
                                          'f8750000-0000-0000-0000-000000000002']::uuid[]) u;
insert into manager_rounds (league_id, round, ends_at) select manager, 1, now() from ctx;
insert into manager_round_bids (league_id, round, user_id, athlete_id, amount, bid_at, won)
select manager, 1, 'f8750000-0000-0000-0000-000000000001', athlete, 35, now(), true from ctx;
insert into manager_round_bids (league_id, round, user_id, athlete_id, amount, bid_at, won)
select manager, 1, 'f8750000-0000-0000-0000-000000000002', athlete, 20, now(), false from ctx;

-- Matchday 1 plays the competition: the away player wins 900 to 700.
insert into manager_matchdays (league_id, round, competition_id)
select manager, 1, competition from ctx;
insert into manager_fixtures (league_id, round, home_id, away_id)
select manager, 1, 'f8750000-0000-0000-0000-000000000001', 'f8750000-0000-0000-0000-000000000002'
from ctx;
insert into manager_scores (league_id, competition_id, user_id, lined_up, total, hungarian, bonus,
                            predictions)
select manager, competition, u, true, t, t, 0, 0
from ctx, (values ('f8750000-0000-0000-0000-000000000001'::uuid, 700),
                  ('f8750000-0000-0000-0000-000000000002'::uuid, 900)) s(u, t);

-- The home player also plays a prediction league.
with l as (
  insert into leagues (name, owner_id) values ('Pronos 875', 'f8750000-0000-0000-0000-000000000001')
  returning id
)
update ctx set league = (select id from l);
insert into league_members (league_id, user_id, role)
select league, 'f8750000-0000-0000-0000-000000000001', 'owner' from ctx;

-- A participant reads the athlete won at the reveal and the duel, scores of both teams.
select set_config('request.jwt.claims',
  json_build_object('sub', 'f8750000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;
select is(
  (select jsonb_array_length(manager_feed(manager) -> 'wins') from ctx), 1,
  'a participant reads the one athlete won at the reveal');
select is(
  (select manager_feed(manager) #>> '{wins,0,athlete}' from ctx), 'Athlète 875',
  'the athlete won is named, with its winner and price');
select is(
  (select array[(manager_feed(manager) #>> '{duels,0,home,score}')::int,
                (manager_feed(manager) #>> '{duels,0,away,score}')::int] from ctx),
  array[700, 900],
  'a participant reads the duel once its matchday is scored');

-- Nobody writes a moment directly.
select throws_ok($$
  insert into manager_moments (league_id, key, kind, user_id)
  select manager, 'badge:x', 'badge', 'f8750000-0000-0000-0000-000000000002' from ctx $$,
  '42501', null, 'a player cannot write a Manager moment directly');

-- The home player publishes a badge level only once they hold it, in each of their leagues.
select set_config('request.jwt.claims',
  json_build_object('sub', 'f8750000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
select is(
  publish_my_badge_moments(jsonb_build_array(jsonb_build_object(
    'key', 'badge:f8750000-0000-0000-0000-000000000001:foudre:bronze',
    'badge', 'foudre', 'level', 'bronze'))),
  0, 'a level not won is not published');
select lives_ok($$ select raise_my_badge_levels('[{"badge": "foudre", "level": "silver"}]') $$,
  'the player wins the silver level of a badge');
select is(
  publish_my_badge_moments(jsonb_build_array(
    jsonb_build_object('key', 'badge:f8750000-0000-0000-0000-000000000001:foudre:silver',
                       'badge', 'foudre', 'level', 'silver'),
    jsonb_build_object('key', 'badge:f8750000-0000-0000-0000-000000000002:foudre:silver',
                       'badge', 'foudre', 'level', 'silver'))),
  2, 'a level won is told in the prediction league and the Manager league, under its own key only');
select is(
  publish_my_badge_moments(jsonb_build_array(jsonb_build_object(
    'key', 'badge:f8750000-0000-0000-0000-000000000001:foudre:silver',
    'badge', 'foudre', 'level', 'silver'))),
  0, 'a level told again adds nothing');
select is(
  (select kind from league_feed((select league from ctx))), 'badge',
  'the badge shows in the feed of the prediction league');

-- The other participant reads the badge in the Manager feed.
select set_config('request.jwt.claims',
  json_build_object('sub', 'f8750000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
select is(
  (select manager_feed(manager) #>> '{published,0,data,badge}' from ctx), 'foudre',
  'a participant reads the badge of another participant');

-- Someone outside the Manager league reads nothing of its feed.
select set_config('request.jwt.claims',
  json_build_object('sub', 'f8750000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
select is(
  (select manager_feed(manager) from ctx),
  '{"published": [], "wins": [], "duels": []}'::jsonb,
  'someone outside the Manager league reads an empty feed');
select is((select count(*) from manager_moments), 0::bigint,
  'someone outside the Manager league reads none of its moments');

select * from finish();
rollback;
