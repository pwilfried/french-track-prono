-- pgTAP: reporting a public league and its moderation by the admin (#321).
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(9);

insert into auth.users (id, email) values
  ('eeee0000-0000-0000-0000-000000000001', 'creator@example.test'),
  ('eeee0000-0000-0000-0000-000000000002', 'reporter@example.test'),
  ('eeee0000-0000-0000-0000-000000000003', 'admin@example.test');
insert into profiles (id, pseudo, age_confirmed_at, is_admin) values
  ('eeee0000-0000-0000-0000-000000000001', 'Créateur', now(), false),
  ('eeee0000-0000-0000-0000-000000000002', 'Signaleur', now(), false),
  ('eeee0000-0000-0000-0000-000000000003', 'Modo', now(), true);
insert into leagues (id, name, owner_id, is_public) values
  ('eeeeeeee-0000-0000-0000-0000000000a1', 'Ligue douteuse', 'eeee0000-0000-0000-0000-000000000001', true),
  ('eeeeeeee-0000-0000-0000-0000000000a2', 'Privée', 'eeee0000-0000-0000-0000-000000000001', false);
insert into league_members (league_id, user_id, role) values
  ('eeeeeeee-0000-0000-0000-0000000000a1', 'eeee0000-0000-0000-0000-000000000001', 'owner'),
  ('eeeeeeee-0000-0000-0000-0000000000a2', 'eeee0000-0000-0000-0000-000000000001', 'owner');

create function act_as(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
set local role authenticated;

select act_as('eeee0000-0000-0000-0000-000000000002');
select lives_ok($$ select report_league('eeeeeeee-0000-0000-0000-0000000000a1') $$,
  'a player reports a public league');
select lives_ok($$ select report_league('eeeeeeee-0000-0000-0000-0000000000a1') $$,
  'reporting twice changes nothing');
select throws_ok($$ select report_league('eeeeeeee-0000-0000-0000-0000000000a2') $$, 'P0002', null,
  'a private league cannot be reported');

select act_as('eeee0000-0000-0000-0000-000000000001');
select is((select count(*) from league_reports), 0::bigint,
  'a player does not see the reports of others');
select throws_ok($$ select * from admin_list_leagues() $$, '42501', null,
  'only the admin lists the leagues');
select throws_ok($$ select admin_rename_league('eeeeeeee-0000-0000-0000-0000000000a1', 'Autre nom') $$,
  '42501', null, 'only the admin renames a league');

select act_as('eeee0000-0000-0000-0000-000000000003');
select is((select report_count from admin_list_leagues()
           where league_id = 'eeeeeeee-0000-0000-0000-0000000000a1'), 1::bigint,
  'the admin sees the league reported once');
select lives_ok($$ select admin_rename_league('eeeeeeee-0000-0000-0000-0000000000a1', 'Les Gazelles') $$,
  'the admin renames the league');
reset role;
select is((select action from admin_actions order by at desc limit 1), 'moderate_league',
  'the moderation is logged');

select * from finish();
rollback;
