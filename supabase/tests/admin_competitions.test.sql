-- pgTAP: the admin creates a competition, its events and its entered athletes; a player cannot.
begin;
select plan(10);

-- #501: one time zone for the whole app, Paris; a competition carries none.
select hasnt_column('competitions', 'time_zone', 'a competition has no time zone of its own');

insert into auth.users (id, email) values
  ('dededede-0000-0000-0000-000000000001', 'player@example.test'),
  ('dededede-0000-0000-0000-000000000002', 'admin@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('dededede-0000-0000-0000-000000000001', 'Joueur', now()),
  ('dededede-0000-0000-0000-000000000002', 'Admin', now());
update profiles set is_admin = true where id = 'dededede-0000-0000-0000-000000000002';

select ok((select count(*) from competition_athletes ca join competitions c on c.id = ca.competition_id
  where c.slug = 'ultimate-championship-2026') > 0, 'the seed start lists enter their athletes');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"dededede-0000-0000-0000-000000000002","role":"authenticated"}', true);

select is(admin_create_competition('test-france-elite', 'Test Élite', 'france', 'Ville', 'fra',
  current_date + 30, current_date + 32), 'test-france-elite', 'an admin creates a competition');
select is(admin_create_competition('test-france-elite', 'Test Élite bis', 'france', '', '',
  current_date + 40, current_date + 41), 'test-france-elite-2', 'a taken slug gets a number');
select is((select scope || ' ' || country_code from competitions where slug = 'test-france-elite'),
  'france FRA', 'the type and the country are stored');

select is(admin_add_event('test-france-elite', 'test-france-elite-f-100m', '100 m', 'F', 'final',
  now() + interval '30 days', now() + interval '30 days' - interval '5 minutes'),
  'test-france-elite-f-100m', 'an admin adds an event');
select throws_ok($$select admin_add_event('nope', 'x-event', '100 m', 'F', 'final', now(), now())$$,
  'FT004', null, 'an event needs a known competition');

select admin_set_competition_athlete('test-france-elite',
  (select id from athletes where slug = 'sha-carri-richardson'), true);
select is((select count(*)::int from competition_athletes ca join competitions c on c.id = ca.competition_id
  where c.slug = 'test-france-elite'), 1, 'an admin enters an athlete');

select set_config('request.jwt.claims',
  '{"sub":"dededede-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$select admin_create_competition('x', 'X', 'france', '', '', current_date, current_date)$$,
  '42501', null, 'a player cannot create a competition');
select throws_ok($$select admin_set_competition_athlete('test-france-elite',
  (select id from athletes limit 1), true)$$, '42501', null, 'a player cannot enter an athlete');

select * from finish();
rollback;
