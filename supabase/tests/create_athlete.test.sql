-- pgTAP: an admin adds an athlete with a free slug; a player cannot. Rolled back at the end.
begin;
select plan(4);

insert into auth.users (id, email) values
  ('abababab-0000-0000-0000-000000000001', 'player@example.test'),
  ('abababab-0000-0000-0000-000000000002', 'admin@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('abababab-0000-0000-0000-000000000001', 'Joueur', now()),
  ('abababab-0000-0000-0000-000000000002', 'Admin', now());
update profiles set is_admin = true where id = 'abababab-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"abababab-0000-0000-0000-000000000002","role":"authenticated"}', true);

select isnt(create_athlete('Athlète Inventée', 'fra', 'F', 'athlete-inventee'), null,
  'an admin adds an athlete');
select is((select country_code::text from athletes where slug = 'athlete-inventee'), 'FRA',
  'the country code is stored in capitals');
select create_athlete('Athlète Inventée', 'FRA', 'F', 'athlete-inventee');
select is((select count(*)::int from athletes where slug like 'athlete-inventee%'), 2,
  'a taken slug gets a number instead of failing');

select set_config('request.jwt.claims',
  '{"sub":"abababab-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$select create_athlete('X', 'FRA', 'F', 'x-player')$$, '42501', null,
  'a player cannot add an athlete');

select * from finish();
rollback;
