-- pgTAP: sex, disciplines and club of a player (#340).
begin;
select plan(11);

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000001', 'dina@example.test'),
  ('cccccccc-0000-0000-0000-000000000002', 'eli@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('cccccccc-0000-0000-0000-000000000001', 'Dina', now()),
  ('cccccccc-0000-0000-0000-000000000002', 'Eli', now());
select import_clubs('[{"name":"Club Test Athlé","city":"Testville","department":"75","siren":"333333333"}]');
insert into clubs (id, name, source, created_by) values
  ('dddddddd-0000-0000-0000-000000000001', 'Club de Dina', 'player', 'cccccccc-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$insert into player_details (profile_id, sex, disciplines)
    values ('cccccccc-0000-0000-0000-000000000001', 'F', '{100 m,200 m,100 m}')$$,
  'a player saves sex and disciplines');
select is((select disciplines from player_details), '{100 m,200 m}'::text[], 'each discipline once');
select throws_ok(
  $$update player_details set disciplines = '{Course en sac}'$$,
  '23503', null, 'an unknown discipline is refused');
select throws_ok(
  $$update player_details set sex = 'X'$$, '23514', null, 'sex is F, M or nothing');

select lives_ok(
  $$update profiles set club_id = (select id from clubs where siren = '333333333')
    where id = 'cccccccc-0000-0000-0000-000000000001'$$,
  'a player picks an imported club');

select isnt(propose_club('Les Foulées de Nulle-Part', 'Nulle-Part'), null, 'a player proposes a missing club');
select is(propose_club('les foulees de nulle part', 'NULLE PART'),
  (select id from clubs where name = 'Les Foulées de Nulle-Part'), 'the same club is not added twice');
select is((select validated from clubs where name = 'Les Foulées de Nulle-Part'), false, 'it waits for validation');
select throws_ok($$select propose_club('Club Officiel FFA')$$, 'FT013', null, 'banned words are refused');

-- Eli sees neither Dina's details nor the club she typed.
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from player_details), 0, 'sex and disciplines are private');
select throws_ok(
  $$update profiles set club_id = 'dddddddd-0000-0000-0000-000000000001'
    where id = 'cccccccc-0000-0000-0000-000000000002'$$,
  'P0002', null, 'a player cannot pick a club they cannot see');

select * from finish();
rollback;
