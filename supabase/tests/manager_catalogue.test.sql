-- pgTAP: the admin prices athletes (#421); a league's participants read its catalogue, an
-- outsider does not. Rolled back at the end.
begin;
select plan(8);

insert into auth.users (id, email) values
  ('aeaeae00-0000-0000-0000-000000000001', 'admin@example.test'),
  ('aeaeae00-0000-0000-0000-000000000002', 'player@example.test'),
  ('aeaeae00-0000-0000-0000-000000000003', 'outsider@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('aeaeae00-0000-0000-0000-000000000001', 'Admin', now()),
  ('aeaeae00-0000-0000-0000-000000000002', 'Joueuse', now()),
  ('aeaeae00-0000-0000-0000-000000000003', 'Dehors', now());
update profiles set is_admin = true where id = 'aeaeae00-0000-0000-0000-000000000001';
insert into athletes (id, slug, name, country_code, gender) values
  ('aeaeae00-0000-0000-0000-0000000000a1', 'cat-sprinteuse', 'Sprinteuse Fictive', 'FRA', 'F'),
  ('aeaeae00-0000-0000-0000-0000000000a2', 'cat-sans-prix', 'Sans Prix', 'FRA', 'M');
insert into athlete_disciplines (athlete_id, discipline, is_primary) values
  ('aeaeae00-0000-0000-0000-0000000000a1', '100 m', true),
  ('aeaeae00-0000-0000-0000-0000000000a2', '100 m', true);
insert into athlete_records (athlete_id, discipline, kind, mark, mark_value) values
  ('aeaeae00-0000-0000-0000-0000000000a1', '100 m', 'pr', '11.02', 11.02);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aeaeae00-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$select admin_set_athlete_price('aeaeae00-0000-0000-0000-0000000000a1', 12)$$,
  '42501', null, 'a player cannot price an athlete');

select set_config('request.jwt.claims',
  '{"sub":"aeaeae00-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($$select admin_set_athlete_price('aeaeae00-0000-0000-0000-0000000000a1', 12)$$,
  'the admin prices an athlete');
select throws_ok($$select admin_set_athlete_price('aeaeae00-0000-0000-0000-0000000000a2', 0)$$,
  '22023', null, 'a price is above 0');

select set_config('request.jwt.claims',
  '{"sub":"aeaeae00-0000-0000-0000-000000000002","role":"authenticated"}', true);
select create_manager_league('Catalogue', false);
reset role;
create temp table t_league as select id from manager_leagues;
grant select on t_league to authenticated;
set local role authenticated;

select is((select price from manager_catalogue((select id from t_league))
           where athlete_id = 'aeaeae00-0000-0000-0000-0000000000a1'), 12,
  'a participant sees the priced athlete with its price');
select is((select pb from manager_catalogue((select id from t_league))
           where athlete_id = 'aeaeae00-0000-0000-0000-0000000000a1'), '11.02',
  'and its PB in its main discipline');
select is((select count(*)::int from manager_catalogue((select id from t_league))
           where athlete_id = 'aeaeae00-0000-0000-0000-0000000000a2'), 0,
  'an athlete without a price is not in the catalogue');

select set_config('request.jwt.claims',
  '{"sub":"aeaeae00-0000-0000-0000-000000000003","role":"authenticated"}', true);
select throws_ok($$select * from manager_catalogue((select id from t_league))$$, '42501', null,
  'an outsider does not read the catalogue');
update athletes set manager_price = 987654;
select is((select count(*)::int from athletes where manager_price = 987654), 0,
  'nobody writes a price by hand');

select * from finish();
rollback;
