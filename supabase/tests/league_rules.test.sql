-- pgTAP: league rules (R8): invite codes, members-only reads, leaving and handing over.
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(18);

insert into auth.users (id, email) values
  ('aaaa0000-0000-0000-0000-000000000001', 'owner@example.test'),
  ('aaaa0000-0000-0000-0000-000000000002', 'friend@example.test'),
  ('aaaa0000-0000-0000-0000-000000000003', 'stranger@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('aaaa0000-0000-0000-0000-000000000001', 'Chef', now()),
  ('aaaa0000-0000-0000-0000-000000000002', 'Ami', now()),
  ('aaaa0000-0000-0000-0000-000000000003', 'Inconnu', now());

create temp table ctx (league uuid, code text);
grant all on ctx to authenticated;

create function act_as(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

set local role authenticated;

-- The owner creates a league ------------------------------------------------------------------
select act_as('aaaa0000-0000-0000-0000-000000000001');
insert into ctx select * from create_league('  Les Foulées  ', array['ultimate-championship-2026']);

select matches((select code from ctx), '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$',
  'the invite code has 6 easy-to-read characters');
select is((select name from leagues where id = (select league from ctx)), 'Les Foulées',
  'the name is trimmed');
select is((select count(*)::int from league_members where league_id = (select league from ctx)), 1,
  'the owner is the first member');
select is((select count(*)::int from league_competitions where league_id = (select league from ctx)), 1,
  'the league counts the competition in progress');
select throws_ok($$insert into leagues (name, owner_id) values ('Direct', 'aaaa0000-0000-0000-0000-000000000001')$$,
  '42501', null, 'a league cannot be created without the function');

-- R8: joining with a code -----------------------------------------------------------------------
select act_as('aaaa0000-0000-0000-0000-000000000002');
select throws_ok($$select join_league('ZZZZZZ')$$, 'P0002', null, 'R8: an unknown code is refused');
select is(join_league(lower(' ' || (select code from ctx) || ' ')), (select league from ctx),
  'R8: a valid code joins, whatever the case and spaces');
select lives_ok($$select join_league((select code from ctx))$$, 'joining twice is accepted');
select is((select count(*)::int from league_members where league_id = (select league from ctx)), 2,
  'joining twice adds the player once');

-- Members-only reads ---------------------------------------------------------------------------
select act_as('aaaa0000-0000-0000-0000-000000000003');
select is((select count(*)::int from leagues where id = (select league from ctx)), 0,
  'a non member cannot read the league');
select is((select count(*)::int from league_members where league_id = (select league from ctx)), 0,
  'a non member cannot read the members');
select act_as('aaaa0000-0000-0000-0000-000000000002');
select is((select count(*)::int from league_members where league_id = (select league from ctx)), 2,
  'a member reads the members');

-- Leaving and handing over ----------------------------------------------------------------------
select act_as('aaaa0000-0000-0000-0000-000000000001');
select throws_ok($$select leave_league((select league from ctx))$$, '2BP01', null,
  'the owner cannot leave while other members remain');
select act_as('aaaa0000-0000-0000-0000-000000000002');
select throws_ok($$select transfer_league((select league from ctx), 'aaaa0000-0000-0000-0000-000000000002')$$,
  '42501', null, 'only the owner hands the league over');
select act_as('aaaa0000-0000-0000-0000-000000000001');
select lives_ok($$select transfer_league((select league from ctx), 'aaaa0000-0000-0000-0000-000000000002')$$,
  'the owner hands the league over to a member');
select lives_ok($$select leave_league((select league from ctx))$$, 'the former owner can then leave');
select act_as('aaaa0000-0000-0000-0000-000000000002');
select is((select owner_id::text from leagues where id = (select league from ctx)),
  'aaaa0000-0000-0000-0000-000000000002', 'the new owner keeps the league');

-- 50 members at most ---------------------------------------------------------------------------
reset role;
insert into auth.users (id, email)
select ('aaaa0000-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid, 'filler-' || n || '@example.test'
from generate_series(1, 49) n;
insert into profiles (id, pseudo, age_confirmed_at)
select ('aaaa0000-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid, 'Remplissage ' || n, now()
from generate_series(1, 49) n;
insert into league_members (league_id, user_id)
select (select league from ctx), ('aaaa0000-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid
from generate_series(1, 49) n;
set local role authenticated;
select act_as('aaaa0000-0000-0000-0000-000000000003');
select throws_ok($$select join_league((select code from ctx))$$, '54000', null,
  'a league of 50 members is full');

select * from finish();
rollback;
