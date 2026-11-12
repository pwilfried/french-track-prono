-- pgTAP: a player creates a Manager league (#419), which keeps the rules in force at its
-- creation; other players do not see it. Rolled back at the end.
begin;
select plan(9);

insert into auth.users (id, email) values
  ('acacac00-0000-0000-0000-000000000001', 'creator@example.test'),
  ('acacac00-0000-0000-0000-000000000002', 'other@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('acacac00-0000-0000-0000-000000000001', 'Createur', now()),
  ('acacac00-0000-0000-0000-000000000002', 'Autre', now());
-- The Manager is open to the admins only (#615): its players here are admins.
update profiles set is_admin = true where id::text like 'acacac00-%';
update manager_rules set rules = jsonb_set(rules, '{budget}', '120');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"acacac00-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($$select create_manager_league('  Les   Sauteurs ', false)$$, 'a player creates a league');
select is((select name from manager_leagues), 'Les Sauteurs', 'its name is tidied');
select is((select owner_id from manager_leagues), 'acacac00-0000-0000-0000-000000000001'::uuid,
  'the creator is its admin');
select is((select count(*)::int from manager_members), 1, 'the creator is its first participant');
select throws_ok($$select create_manager_league('Ligue FFA', false)$$, 'FT010', null,
  'a banned name is refused, even for a private league');
select throws_ok($$insert into manager_members (league_id, user_id)
  select id, 'acacac00-0000-0000-0000-000000000002' from manager_leagues$$, '42501', null,
  'nobody adds a participant by hand');

reset role;
update manager_rules set rules = jsonb_set(rules, '{budget}', '300');
select is((select (rules ->> 'budget')::int from manager_leagues), 120,
  'a change of the rules does not touch a league already created');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"acacac00-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from manager_leagues), 0, 'another player does not see the league');
select is((select count(*)::int from manager_members), 0, 'nor its participants');

select * from finish();
rollback;
