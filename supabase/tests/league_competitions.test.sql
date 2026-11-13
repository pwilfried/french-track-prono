-- pgTAP: a league on one or several competitions (#267), created with at least one active
-- competition and completed later (#614). Run with `supabase test db`. Everything is rolled back.
begin;
select plan(17);

insert into auth.users (id, email) values ('cccc0000-0000-0000-0000-000000000001', 'owner@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values ('cccc0000-0000-0000-0000-000000000001', 'Chef', now());
insert into competitions (slug, name, starts_on, ends_on)
values ('test-league-a', 'Test A', current_date + 10, current_date + 11),
       ('test-league-b', 'Test B', current_date + 20, current_date + 21),
       ('test-league-running', 'Test en cours', current_date - 2, current_date + 2),
       ('test-league-finished', 'Test terminée', current_date - 5, current_date - 2);
insert into auth.users (id, email) values ('cccc0000-0000-0000-0000-000000000002', 'friend@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values ('cccc0000-0000-0000-0000-000000000002', 'Ami', now());

create temp table ctx (league uuid, code text);
grant all on ctx to authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'cccc0000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into ctx select * from create_league('Deux compétitions', array['test-league-a', 'test-league-b', 'test-league-a']);
select is(
  (select array_agg(c.slug order by c.slug) from league_competitions lc
     join competitions c on c.id = lc.competition_id where lc.league_id = (select league from ctx)),
  array['test-league-a', 'test-league-b']::text[],
  'the league counts each chosen competition once');
select is(
  (select count(*) from league_competitions
    where league_id = (select league from ctx) and added_at = now()),
  2::bigint, 'each competition enters the league at its creation');

-- #614: at least one active competition.
select throws_ok($$ select create_league('Vide', array[]::text[]) $$,
  'FT030', null, 'a league without competition is refused');
select throws_ok($$ select create_league('Vide public', array[]::text[], true) $$,
  'FT030', null, 'a public league without competition is refused too');
select throws_ok($$ select create_league('Finie', array['test-league-a', 'test-league-finished']) $$,
  'FT009', null, 'a finished competition is refused at creation');

create temp table running (league uuid, code text);
grant all on running to authenticated;
insert into running select * from create_league('En cours', array['test-league-running']);
select is((select count(*) from league_competitions where league_id = (select league from running)),
  1::bigint, 'a league is created on a competition under way');

select lives_ok($$ select add_league_competition((select league from running), 'test-league-b') $$,
  'the creator adds a coming competition');
reset role;
-- Back-date its entry, to check that adding it again keeps the first date.
update league_competitions set added_at = now() - interval '1 hour'
 where league_id = (select league from running)
   and competition_id = (select id from competitions where slug = 'test-league-b');
set local role authenticated;
select lives_ok($$ select add_league_competition((select league from running), 'test-league-b') $$,
  'adding it twice changes nothing');
select is(
  (select added_at from league_competitions
    where league_id = (select league from running)
      and competition_id = (select id from competitions where slug = 'test-league-b')),
  now() - interval '1 hour', 'adding it twice keeps its first date');
select is(
  (select array_agg(c.slug order by c.slug) from league_competitions lc join competitions c on c.id = lc.competition_id
     where lc.league_id = (select league from running)),
  array['test-league-b', 'test-league-running']::text[], 'the league now counts that competition');
select lives_ok($$ select add_league_competition((select league from ctx), 'test-league-running') $$,
  'a competition under way can be added');
select throws_ok($$ select add_league_competition((select league from running), 'test-league-finished') $$,
  'FT009', null, 'a finished competition cannot be added');
select throws_ok($$ select add_league_competition((select league from running), 'no-such-competition') $$,
  'P0002', null, 'an unknown competition cannot be added');
select throws_ok($$ select create_league('Inconnue', array['test-league-a', 'no-such-competition']) $$,
  'P0002', null, 'an unknown competition is refused');
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', 'cccc0000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;
select throws_ok($$ select add_league_competition((select league from running), 'test-league-a') $$,
  '42501', null, 'only the creator adds a competition');
reset role;
select is((select count(*) from leagues where name in ('Inconnue', 'Vide', 'Vide public', 'Finie')), 0::bigint,
  'a refused league is not created');

select set_config('request.jwt.claims', '{}', true);
select throws_ok($$ select create_league('Anonyme', array['test-league-a']) $$, '42501', null,
  'a visitor cannot create a league');

select * from finish();
rollback;
