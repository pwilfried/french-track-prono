-- pgTAP: every event has a discipline of the reference table, which says which way is better;
-- only an admin changes a tolerance. Everything is rolled back at the end.
begin;
select plan(9);

insert into auth.users (id, email) values
  ('efefefef-0000-0000-0000-000000000001', 'player@example.test'),
  ('efefefef-0000-0000-0000-000000000002', 'admin@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('efefefef-0000-0000-0000-000000000001', 'Joueur', now()),
  ('efefefef-0000-0000-0000-000000000002', 'Admin', now());
update profiles set is_admin = true where id = 'efefefef-0000-0000-0000-000000000002';

select is((select count(*)::int from events e left join disciplines d on d.name = e.discipline
  where d.name is null), 0, 'every event of the seed has a discipline');
select ok(is_better_mark('100 m', 10.85, 10.78), '10.78 beats 10.85 on 100 m (from the table)');
select ok(is_better_mark('Saut en hauteur', 2.31, 2.34), '2.34 beats 2.31 in high jump (from the table)');
select is((select (family, unit, lower_is_better)::text from disciplines where name = 'Marathon'),
  '(long,time,t)', 'the marathon is a long-distance race, timed, lower is better');
select ok(is_better_mark('Marathon', 7751, 7744), '2:09:04 beats 2:09:11 in the marathon');
select throws_ok($$insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
  select id, 'no-discipline', 'Course en sac', 'F', now(), now() from competitions limit 1$$,
  '23503', null, 'an event needs a known discipline');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"efefefef-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok($$select set_discipline_tolerance('100 m', 0.03)$$, 'an admin changes the 100 m tolerance');
select is((select tolerance from disciplines where name = '100 m'), 0.03, 'the new tolerance is stored');

select set_config('request.jwt.claims',
  '{"sub":"efefefef-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$select set_discipline_tolerance('100 m', 1)$$, '42501', null,
  'a player cannot change a tolerance');

select * from finish();
rollback;
