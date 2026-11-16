-- pgTAP: the admin sets the condition and the presence in France of an athlete (#1028), logged as
-- edit_athlete; a player cannot. Rolled back at the end.
begin;
select plan(7);

insert into auth.users (id, email) values
  ('aeaeae10-0000-0000-0000-000000000001', 'admin@example.test'),
  ('aeaeae10-0000-0000-0000-000000000002', 'player@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('aeaeae10-0000-0000-0000-000000000001', 'Admin', now()),
  ('aeaeae10-0000-0000-0000-000000000002', 'Joueuse', now());
update profiles set is_admin = true where id = 'aeaeae10-0000-0000-0000-000000000001';
insert into athletes (id, slug, name, country_code, gender) values
  ('aeaeae10-0000-0000-0000-0000000000a1', 'prix-sprinteuse', 'Sprinteuse Fictive', 'FRA', 'F');

select is((select manager_condition || '/' || france_presence from athletes
           where id = 'aeaeae10-0000-0000-0000-0000000000a1'),
  'fit/sometimes', 'an athlete is fit and sometimes in France by default');
select ok((select rules ? 'pricing' from manager_rules), 'the Manager rules carry a pricing');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aeaeae10-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok(
  $$select admin_set_athlete_manager_profile('aeaeae10-0000-0000-0000-0000000000a1', 'out', 'rarely')$$,
  '42501', null, 'a player cannot set the condition of an athlete');

select set_config('request.jwt.claims',
  '{"sub":"aeaeae10-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok(
  $$select admin_set_athlete_manager_profile('aeaeae10-0000-0000-0000-0000000000a1', 'doubtful', 'rarely')$$,
  'the admin sets the condition and the presence in France');
select throws_ok(
  $$select admin_set_athlete_manager_profile('aeaeae10-0000-0000-0000-0000000000a1', 'tired', 'often')$$,
  '22023', null, 'an unknown condition is refused');

reset role;
select is((select manager_condition || '/' || france_presence from athletes
           where id = 'aeaeae10-0000-0000-0000-0000000000a1'),
  'doubtful/rarely', 'the athlete page keeps them');
select is((select count(*)::int from admin_actions
           where action = 'edit_athlete'
             and payload ->> 'manager_condition' = 'doubtful'
             and payload ->> 'athlete' = 'aeaeae10-0000-0000-0000-0000000000a1'),
  1, 'the change is logged as edit_athlete');

select * from finish();
rollback;
