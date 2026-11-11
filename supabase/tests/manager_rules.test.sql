-- pgTAP: the admin of French Track Prono sets the Manager rules (#418); a player cannot.
-- Rolled back at the end.
begin;
select plan(9);

insert into auth.users (id, email) values
  ('ababab00-0000-0000-0000-000000000001', 'admin@example.test'),
  ('ababab00-0000-0000-0000-000000000002', 'player@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('ababab00-0000-0000-0000-000000000001', 'Admin', now()),
  ('ababab00-0000-0000-0000-000000000002', 'Joueur', now());
update profiles set is_admin = true where id = 'ababab00-0000-0000-0000-000000000001';
insert into competitions (slug, name, starts_on, ends_on)
values ('manager-meeting', 'Meeting Manager', '2027-06-01', '2027-06-01');

select is((select (rules ->> 'budget')::int from manager_rules), 100, 'the rules start with a budget of 100');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"ababab00-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from manager_rules), 1, 'a player reads the rules');
select throws_ok($$select admin_set_manager_rules('{"budget": 999}', '{}')$$, '42501', null,
  'a player cannot set the rules');
select throws_ok($$update manager_rules set rules = '{"budget": 999}'$$, '42501', null,
  'a player cannot write the table');

select set_config('request.jwt.claims',
  '{"sub":"ababab00-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($$select admin_set_manager_rules('{"budget": 150}', '{manager-meeting}')$$,
  'an admin sets the rules and the eligible competitions');
select is((select (rules ->> 'budget')::int from manager_rules), 150, 'the new budget is kept');
select is((select count(*)::int from manager_competitions), 1, 'the competition is eligible');
select throws_ok($$select admin_set_manager_rules('{"budget": 0}', '{}')$$, '22023', null,
  'rules without a positive budget are refused');
select throws_ok($$select admin_set_manager_rules('{"budget": 150}', '{no-such-meeting}')$$, 'P0002', null,
  'an unknown competition is refused');

select * from finish();
rollback;
