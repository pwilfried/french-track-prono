-- pgTAP: the admin corrects a competition and its events (#293); nothing predicted is deleted,
-- and a predicted event keeps its round. Rolled back at the end.
begin;
select plan(9);

insert into auth.users (id, email) values
  ('cfcfcfcf-0000-0000-0000-000000000001', 'admin@example.test'),
  ('cfcfcfcf-0000-0000-0000-000000000002', 'player@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('cfcfcfcf-0000-0000-0000-000000000001', 'Admin', now()),
  ('cfcfcfcf-0000-0000-0000-000000000002', 'Joueur', now());
update profiles set is_admin = true where id = 'cfcfcfcf-0000-0000-0000-000000000001';

with c as (
  insert into competitions (slug, name, starts_on, ends_on)
  values ('edit-test', 'Edit test', current_date + 5, current_date + 6) returning id
)
insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
select id, s, '100 m', 'F', now() + interval '5 days', now() + interval '5 days'
from c, unnest(array['edit-test-a', 'edit-test-b']) s;
insert into entries (event_id, athlete_id)
select e.id, a.id from events e, (select id from athletes order by id limit 3) a where e.slug = 'edit-test-b';
-- Someone predicted event b.
insert into predictions (user_id, event_id, p1, p2, p3)
select 'cfcfcfcf-0000-0000-0000-000000000002', e.id,
       (array_agg(en.athlete_id order by en.athlete_id))[1], (array_agg(en.athlete_id order by en.athlete_id))[2],
       (array_agg(en.athlete_id order by en.athlete_id))[3]
from events e join entries en on en.event_id = e.id where e.slug = 'edit-test-b' group by e.id;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cfcfcfcf-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok($$select admin_update_competition('edit-test', 'Edit test bis', 'france', 'Lyon', 'fra',
  current_date + 5, current_date + 7, 'Europe/Paris')$$, 'an admin corrects a competition');
reset role;
select is((select name || ' ' || city || ' ' || country_code from competitions where slug = 'edit-test'),
  'Edit test bis Lyon FRA', 'the correction is kept');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cfcfcfcf-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok($$select admin_update_event('edit-test-b', 'final', now() + interval '6 days', now() + interval '6 days')$$,
  'a predicted event can still be moved');
select throws_ok($$select admin_update_event('edit-test-b', 'semi', now() + interval '6 days', now() + interval '6 days')$$,
  'FT008', null, 'a predicted event keeps its round');
select throws_ok($$select admin_delete_event('edit-test-b')$$, 'FT008', null, 'a predicted event is not deleted');
select lives_ok($$select admin_delete_event('edit-test-a')$$, 'an event nobody predicted is deleted');
select throws_ok($$select admin_delete_competition('edit-test')$$, 'FT008', null,
  'a predicted competition is not deleted');
select throws_ok($$select admin_delete_event('no-such-event')$$, 'FT004', null, 'an unknown event is refused');

select set_config('request.jwt.claims',
  '{"sub":"cfcfcfcf-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$select admin_update_competition('edit-test', 'X', 'france', null, null,
  current_date, current_date, 'Europe/Paris')$$, '42501', null, 'a player cannot edit a competition');

select * from finish();
rollback;
