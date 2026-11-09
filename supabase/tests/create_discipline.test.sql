-- pgTAP: the admin creates a discipline (#292).
begin;
select plan(6);

insert into auth.users (id, email) values
  ('ffffffff-0000-0000-0000-000000000001', 'admin-disc@example.test'),
  ('ffffffff-0000-0000-0000-000000000002', 'hugo@example.test');
insert into profiles (id, pseudo, age_confirmed_at, is_admin) values
  ('ffffffff-0000-0000-0000-000000000001', 'Admin Disc', now(), true),
  ('ffffffff-0000-0000-0000-000000000002', 'Hugo', now(), false);

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"ffffffff-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$select create_discipline('60 m haies', 'hurdles', 'time', true, 0.05)$$,
  '42501', null, 'a player cannot create a discipline');

select set_config('request.jwt.claims',
  '{"sub":"ffffffff-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($$select create_discipline('  60 m   haies ', 'hurdles', 'time', true, 0.05)$$,
  'the admin creates a discipline');
select is((select family from disciplines where name = '60 m haies'), 'hurdles', 'it is stored, name tidied');
select throws_ok($$select create_discipline('60 M HAIES', 'hurdles', 'time', true, 0.05)$$,
  '23505', null, 'a name already used is refused');
select throws_ok($$select create_discipline('Mile', 'middle', 'time', true, 0)$$,
  '23514', null, 'the tolerance must be above zero');
select is((select count(*)::int from admin_actions where action = 'create_discipline'), 1,
  'the creation is logged');

select * from finish();
rollback;
