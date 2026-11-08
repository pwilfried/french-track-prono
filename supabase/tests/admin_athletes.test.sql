-- pgTAP: the admin edits an athlete, their disciplines and their PR/SB; a player cannot.
begin;
select plan(7);

insert into auth.users (id, email) values
  ('fafafafa-0000-0000-0000-000000000001', 'player@example.test'),
  ('fafafafa-0000-0000-0000-000000000002', 'admin@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('fafafafa-0000-0000-0000-000000000001', 'Joueur', now()),
  ('fafafafa-0000-0000-0000-000000000002', 'Admin', now());
update profiles set is_admin = true where id = 'fafafafa-0000-0000-0000-000000000002';

create temp table fixture as select id as athlete from athletes where slug = 'sha-carri-richardson';
grant select on fixture to authenticated;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"fafafafa-0000-0000-0000-000000000002","role":"authenticated"}', true);

select admin_set_athlete_discipline((select athlete from fixture), '200 m', true);
select is((select array_agg(discipline order by discipline) filter (where is_primary)
  from athlete_disciplines where athlete_id = (select athlete from fixture)), array['200 m'],
  'a new main discipline replaces the previous main one');

select admin_set_athlete_record((select athlete from fixture), '200 m', 'pr', '21.92', 21.92, '2023-08-25');
select admin_set_athlete_record((select athlete from fixture), '200 m', 'sb', '22.10', 22.10, null);
select results_eq(
  $$select kind, mark, verified from athlete_records
    where athlete_id = (select athlete from fixture) and discipline = '200 m' order by kind$$,
  $$values ('pr', '21.92', true), ('sb', '22.10', true)$$,
  'the admin enters a PR and an SB, marked verified');

select admin_set_athlete_record((select athlete from fixture), '200 m', 'sb', '', null, null);
select is((select count(*)::int from athlete_records
  where athlete_id = (select athlete from fixture) and discipline = '200 m' and kind = 'sb'), 0,
  'an empty mark removes the SB');

select admin_update_athlete((select athlete from fixture), 'Sha''Carri Richardson', 'usa', 'F');
select is((select country_code::text from athletes where id = (select athlete from fixture)), 'USA',
  'the country is stored in capitals');

select admin_remove_athlete_discipline((select athlete from fixture), '200 m');
select is((select count(*)::int from athlete_disciplines
  where athlete_id = (select athlete from fixture) and discipline = '200 m'), 0, 'a discipline is removed');

select set_config('request.jwt.claims',
  '{"sub":"fafafafa-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$select admin_set_athlete_record((select athlete from fixture), '100 m', 'pr', '9.00', 9, null)$$,
  '42501', null, 'a player cannot enter a record');
select throws_ok($$select admin_update_athlete((select athlete from fixture), 'X', 'FRA', 'F')$$,
  '42501', null, 'a player cannot edit an athlete');

select * from finish();
rollback;
