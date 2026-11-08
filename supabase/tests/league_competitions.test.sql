-- pgTAP: a league on one or several competitions (#267), created empty and completed later (#312).
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(11);

insert into auth.users (id, email) values ('cccc0000-0000-0000-0000-000000000001', 'owner@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values ('cccc0000-0000-0000-0000-000000000001', 'Chef', now());
insert into competitions (slug, name, starts_on, ends_on)
values ('test-league-a', 'Test A', current_date + 10, current_date + 11),
       ('test-league-b', 'Test B', current_date + 20, current_date + 21),
       ('test-league-started', 'Test commencée', current_date, current_date + 1);
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

create temp table empty_league (league uuid, code text);
grant all on empty_league to authenticated;
insert into empty_league select * from create_league('Vide', array[]::text[]);
select is((select count(*) from league_competitions where league_id = (select league from empty_league)),
  0::bigint, 'a league can be created without competition');

select lives_ok($$ select add_league_competition((select league from empty_league), 'test-league-b') $$,
  'the creator adds a coming competition');
select lives_ok($$ select add_league_competition((select league from empty_league), 'test-league-b') $$,
  'adding it twice changes nothing');
select is(
  (select array_agg(c.slug) from league_competitions lc join competitions c on c.id = lc.competition_id
     where lc.league_id = (select league from empty_league)),
  array['test-league-b']::text[], 'the league now counts that competition');
select throws_ok($$ select add_league_competition((select league from empty_league), 'test-league-started') $$,
  'FT009', null, 'a competition that has started cannot be added');
select throws_ok($$ select add_league_competition((select league from empty_league), 'no-such-competition') $$,
  'P0002', null, 'an unknown competition cannot be added');
select throws_ok($$ select create_league('Inconnue', array['test-league-a', 'no-such-competition']) $$,
  'P0002', null, 'an unknown competition is refused');
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', 'cccc0000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;
select throws_ok($$ select add_league_competition((select league from empty_league), 'test-league-a') $$,
  '42501', null, 'only the creator adds a competition');
reset role;
select is((select count(*) from leagues where name = 'Inconnue'), 0::bigint,
  'a refused league is not created');

select set_config('request.jwt.claims', '{}', true);
select throws_ok($$ select create_league('Anonyme', array['test-league-a']) $$, '42501', null,
  'a visitor cannot create a league');

select * from finish();
rollback;
