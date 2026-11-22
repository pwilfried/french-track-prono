-- pgTAP: the admin moves a competition's events with it (#1070); each keeps its Paris time and
-- its lock delay, across a change of summer time. Rolled back at the end.
begin;
select plan(6);

insert into auth.users (id, email) values
  ('cfcfcfcf-0000-0000-0000-000000001070', 'admin@example.test'),
  ('cfcfcfcf-0000-0000-0000-000000001071', 'player@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('cfcfcfcf-0000-0000-0000-000000001070', 'Admin', now()),
  ('cfcfcfcf-0000-0000-0000-000000001071', 'Joueur', now());
update profiles set is_admin = true where id = 'cfcfcfcf-0000-0000-0000-000000001070';

-- 18:35 in Paris on 24 Oct 2099 (summer time), locked 5 minutes before.
with c as (
  insert into competitions (slug, name, starts_on, ends_on)
  values ('shift-test', 'Shift test', '2099-10-24', '2099-10-25') returning id
)
insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
select id, 'shift-test-a', '100 m', 'F', '2099-10-24 16:35:00+00', '2099-10-24 16:30:00+00' from c;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cfcfcfcf-0000-0000-0000-000000001071","role":"authenticated"}', true);
select throws_ok($$select admin_shift_competition_events('shift-test', 7)$$, '42501', null,
  'a player cannot move the events');

select set_config('request.jwt.claims',
  '{"sub":"cfcfcfcf-0000-0000-0000-000000001070","role":"authenticated"}', true);
select throws_ok($$select admin_shift_competition_events('no-such-competition', 7)$$, 'FT004', null,
  'an unknown competition is refused');
select is(admin_shift_competition_events('shift-test', 7), 1, 'an admin moves the events of a competition');

reset role;
select is((select to_char(starts_at at time zone 'Europe/Paris', 'YYYY-MM-DD HH24:MI') from events where slug = 'shift-test-a'),
  '2099-10-31 18:35', 'the event keeps its Paris time a week later, in winter time');
select is((select starts_at - lock_at from events where slug = 'shift-test-a'),
  interval '5 minutes', 'the lock stays as long before the start');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cfcfcfcf-0000-0000-0000-000000001070","role":"authenticated"}', true);
select is(admin_shift_competition_events('shift-test', -7), 1, 'the events move back as well');

select * from finish();
rollback;
