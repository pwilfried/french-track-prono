-- pgTAP: a league on one or several competitions (#267).
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(5);

insert into auth.users (id, email) values ('cccc0000-0000-0000-0000-000000000001', 'owner@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values ('cccc0000-0000-0000-0000-000000000001', 'Chef', now());
insert into competitions (slug, name, starts_on, ends_on)
values ('test-league-a', 'Test A', current_date + 10, current_date + 11),
       ('test-league-b', 'Test B', current_date + 20, current_date + 21);

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

select throws_ok($$ select create_league('Vide', array[]::text[]) $$, '22023', null,
  'a league needs at least one competition');
select throws_ok($$ select create_league('Inconnue', array['test-league-a', 'no-such-competition']) $$,
  'P0002', null, 'an unknown competition is refused');
reset role;
select is((select count(*) from leagues where name in ('Vide', 'Inconnue')), 0::bigint,
  'a refused league is not created');

select set_config('request.jwt.claims', '{}', true);
select throws_ok($$ select create_league('Anonyme', array['test-league-a']) $$, '42501', null,
  'a visitor cannot create a league');

select * from finish();
rollback;
