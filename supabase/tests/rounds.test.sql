-- pgTAP: a final opens to predictions only once its semi-finals are finished; heats never open;
-- the first of a semi-final move to the final. Everything is rolled back at the end.
begin;
select plan(7);

insert into auth.users (id, email) values
  ('cdcdcdcd-0000-0000-0000-000000000001', 'player@example.test'),
  ('cdcdcdcd-0000-0000-0000-000000000002', 'admin@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('cdcdcdcd-0000-0000-0000-000000000001', 'Joueur', now()),
  ('cdcdcdcd-0000-0000-0000-000000000002', 'Admin', now());
update profiles set is_admin = true where id = 'cdcdcdcd-0000-0000-0000-000000000002';

-- A final and its semi-final, both open; the semi has three athletes and a result.
create temp table fixture as
with c as (select id from competitions limit 1),
f as (
  insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
  select id, 'rounds-final', '100 m', 'F', now() + interval '2 days', now() + interval '2 days' from c
  returning id
),
s as (
  insert into events (competition_id, slug, discipline, gender, starts_at, lock_at, round, parent_id)
  select c.id, 'rounds-semi', '100 m', 'F', now() + interval '1 day', now() + interval '1 day', 'semi', f.id
  from c, f returning id
)
select f.id as final_id, s.id as semi_id, array(select id from athletes order by id limit 3) as athletes
from f, s;
grant select on fixture to authenticated;

insert into entries (event_id, athlete_id) select semi_id, unnest(athletes) from fixture;
insert into results (event_id, athlete_id, rank, mark)
select semi_id, athletes[i], i, '11.0' || i from fixture, generate_series(1, 3) i;

select ok(not is_predictable((select final_id from fixture)), 'a final waits for its semi-final');
select ok(not is_predictable((select semi_id from fixture)), 'a semi-final is never predicted');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cdcdcdcd-0000-0000-0000-000000000002","role":"authenticated"}', true);

select is(promote_to_next_round((select semi_id from fixture), 2), 2,
  'the first two of the semi-final join the final');
select is(
  (select array_agg(athlete_id order by athlete_id) from entries where event_id = (select final_id from fixture)),
  (select athletes[1:2] from fixture), 'the final start list holds the first two of the semi');

select set_config('request.jwt.claims',
  '{"sub":"cdcdcdcd-0000-0000-0000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$insert into predictions (user_id, event_id, p1, p2, p3)
    select 'cdcdcdcd-0000-0000-0000-000000000001', semi_id, athletes[1], athletes[2], athletes[3] from fixture$$,
  'FT001', null, 'a player cannot predict a semi-final');

select throws_ok($$select promote_to_next_round((select semi_id from fixture), 2)$$, '42501', null,
  'a player cannot promote athletes');

reset role;
update events set status = 'finished' where id = (select semi_id from fixture);
select ok(is_predictable((select final_id from fixture)), 'the final opens once its semi-final is finished');

select * from finish();
rollback;
