-- pgTAP: « Me prévenir à la publication » (#659), who is told when the programme is out.
begin;
select plan(12);

-- A competition without any event yet.
insert into competitions (slug, name, starts_on, ends_on)
values ('program-alert-meeting', 'Meeting des Alertes', current_date + 30, current_date + 31);

-- A and B ask to be told, C has no device.
insert into auth.users (id, email) values
  ('dededede-0000-0000-0000-00000000000a', 'program-a@example.test'),
  ('dededede-0000-0000-0000-00000000000b', 'program-b@example.test'),
  ('dededede-0000-0000-0000-00000000000c', 'program-c@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('dededede-0000-0000-0000-00000000000a', 'ProgA', now()),
  ('dededede-0000-0000-0000-00000000000b', 'ProgB', now()),
  ('dededede-0000-0000-0000-00000000000c', 'ProgC', now());
insert into push_subscriptions (endpoint, user_id, p256dh, auth) values
  ('https://push.example.test/prog-a', 'dededede-0000-0000-0000-00000000000a', 'key-a', 'auth-a'),
  ('https://push.example.test/prog-b', 'dededede-0000-0000-0000-00000000000b', 'key-b', 'auth-b');

set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_ok($$select turn_on_program_alert('program-alert-meeting')$$, '42501', null,
  'a visitor cannot ask to be told');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dededede-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select turn_on_program_alert('program-alert-meeting')$$, 'a player turns their alert on');
select lives_ok($$select turn_on_program_alert('program-alert-meeting')$$, 'turning it on twice changes nothing');
select set_config('request.jwt.claims', '{"sub":"dededede-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select turn_on_program_alert('program-alert-meeting');
select is((select count(*)::int from program_alerts), 1, 'a player only sees their own alerts');
select lives_ok($$select turn_off_program_alert('program-alert-meeting')$$, 'a player turns their alert off');
select is((select count(*)::int from program_alerts), 0, 'the alert is gone');
select turn_on_program_alert('program-alert-meeting');
select throws_ok($$insert into program_alerts (user_id, competition_id)
                   select auth.uid(), id from competitions where slug = 'program-alert-meeting'$$,
  '42501', null, 'the table is not written directly');
select throws_ok($$select * from private.program_due()$$, '42501', null, 'the app cannot read what is due');
select set_config('request.jwt.claims', '{"sub":"dededede-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select turn_on_program_alert('program-alert-meeting');
reset role;

select is_empty($$select * from private.program_due() where competition_slug = 'program-alert-meeting'$$,
  'nothing is due while the programme is not published');

-- The admin publishes a first event.
insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
select id, 'program-alert-meeting-100m-f', '100 m', 'F', now() + interval '30 days', now() + interval '30 days'
from competitions where slug = 'program-alert-meeting';

select results_eq(
  $$select user_id, competition_name, jsonb_array_length(devices) from private.program_due()
    where competition_slug = 'program-alert-meeting' order by user_id$$,
  $$values ('dededede-0000-0000-0000-00000000000a'::uuid, 'Meeting des Alertes', 1),
           ('dededede-0000-0000-0000-00000000000b'::uuid, 'Meeting des Alertes', 1)$$,
  'each subscriber with a device is due once the first event is out');

select private.program_mark_sent(jsonb_build_array(
  jsonb_build_object('user_id', 'dededede-0000-0000-0000-00000000000a', 'competition_slug', 'program-alert-meeting'),
  jsonb_build_object('user_id', 'dededede-0000-0000-0000-00000000000b', 'competition_slug', 'program-alert-meeting')));
select is_empty($$select * from private.program_due() where competition_slug = 'program-alert-meeting'$$,
  'nothing is due again once sent');

-- C gets a device but is blocked.
insert into push_subscriptions (endpoint, user_id, p256dh, auth) values
  ('https://push.example.test/prog-c', 'dededede-0000-0000-0000-00000000000c', 'key-c', 'auth-c');
update profiles set blocked_at = now() where id = 'dededede-0000-0000-0000-00000000000c';
select is_empty($$select * from private.program_due() where competition_slug = 'program-alert-meeting'$$,
  'a blocked player gets nothing');

select * from finish();
rollback;
