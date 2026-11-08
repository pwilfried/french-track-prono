-- pgTAP: F13, a player deletes his account. Everything is rolled back at the end.
begin;
select plan(10);

insert into auth.users (id, email) values
  ('dddd0000-0000-0000-0000-000000000001', 'leaving@example.test'),
  ('dddd0000-0000-0000-0000-000000000002', 'first-friend@example.test'),
  ('dddd0000-0000-0000-0000-000000000003', 'second-friend@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('dddd0000-0000-0000-0000-000000000001', 'Partant', now()),
  ('dddd0000-0000-0000-0000-000000000002', 'Premier', now()),
  ('dddd0000-0000-0000-0000-000000000003', 'Second', now());

create temp table ctx (shared uuid, alone uuid, code text);
grant all on ctx to authenticated;

create function act_as(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

set local role authenticated;

-- The leaving player owns two leagues: one shared with two friends, one alone.
select act_as('dddd0000-0000-0000-0000-000000000001');
insert into ctx (shared, code) select league_id, invite_code from create_league('Partagée', array['ultimate-championship-2026']);
update ctx set alone = (select league_id from create_league('Solo', array['ultimate-championship-2026']));
select act_as('dddd0000-0000-0000-0000-000000000002');
select join_league((select code from ctx));
select act_as('dddd0000-0000-0000-0000-000000000003');
select join_league((select code from ctx));
-- The second friend joined later.
reset role;
update league_members set joined_at = now() + interval '1 minute'
where user_id = 'dddd0000-0000-0000-0000-000000000003';
insert into score_events (user_id, competition_id, event_id, source, points, reason, detail)
select 'dddd0000-0000-0000-0000-000000000001', e.competition_id, e.id, 'prediction', 3, 'prediction', '{}'::jsonb
from events e limit 1;
set local role authenticated;

select set_config('request.jwt.claims', '{}', true);
select throws_ok($$select delete_my_account()$$, '42501', null,
  'nobody signed in cannot delete an account');

select act_as('dddd0000-0000-0000-0000-000000000001');
select lives_ok($$select delete_my_account()$$, 'a player deletes his own account');

reset role;
select is((select count(*)::int from auth.users where id = 'dddd0000-0000-0000-0000-000000000001'), 0,
  'the auth user is gone');
select is((select count(*)::int from profiles where id = 'dddd0000-0000-0000-0000-000000000001'), 0,
  'the profile is gone');
select is((select count(*)::int from score_events where user_id = 'dddd0000-0000-0000-0000-000000000001'), 0,
  'his points are gone');
select is((select count(*)::int from league_members where user_id = 'dddd0000-0000-0000-0000-000000000001'), 0,
  'his memberships are gone');
select is((select owner_id from leagues where id = (select shared from ctx)),
  'dddd0000-0000-0000-0000-000000000002'::uuid, 'a shared league goes to its oldest other member');
select is((select role::text from league_members where league_id = (select shared from ctx)
  and user_id = 'dddd0000-0000-0000-0000-000000000002'), 'owner', 'the heir becomes owner');
select is((select count(*)::int from leagues where id = (select alone from ctx)), 0,
  'a league he was alone in is deleted');
select is((select count(*)::int from profiles where id in
  ('dddd0000-0000-0000-0000-000000000002', 'dddd0000-0000-0000-0000-000000000003')), 2,
  'the other players are untouched');

select * from finish();
rollback;
