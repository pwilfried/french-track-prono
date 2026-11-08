-- pgTAP: public leagues (#277): joined without a code, 200 players at most, banned names refused.
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(10);

insert into auth.users (id, email) values
  ('bbbb0000-0000-0000-0000-000000000001', 'creator@example.test'),
  ('bbbb0000-0000-0000-0000-000000000002', 'walker@example.test'),
  ('bbbb0000-0000-0000-0000-000000000003', 'late@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('bbbb0000-0000-0000-0000-000000000001', 'Créatrice', now()),
  ('bbbb0000-0000-0000-0000-000000000002', 'Passant', now()),
  ('bbbb0000-0000-0000-0000-000000000003', 'Retard', now());

create temp table pub (league uuid, code text);
create temp table priv (league uuid, code text);
grant all on pub, priv to authenticated;

create function act_as(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

set local role authenticated;
select act_as('bbbb0000-0000-0000-0000-000000000001');
insert into pub select * from create_league('Les Gazelles', array['ultimate-championship-2026'], true);
insert into priv select * from create_league('Entre nous', array['ultimate-championship-2026']);

select throws_ok($$ select create_league('Ligue officielle', array[]::text[], true) $$, 'FT010', null,
  'a public league with a banned name is refused');
select throws_ok($$ select create_league('La F F A', array[]::text[], true) $$, 'FT010', null,
  'a banned word typed apart is refused too');
select lives_ok($$ select create_league('Concorde AC', array[]::text[], true) $$,
  'a name that only starts like a banned word is fine');

-- Another player finds it in the list and joins without a code.
select act_as('bbbb0000-0000-0000-0000-000000000002');
select is((select member_count from list_public_leagues() where league_id = (select league from pub)),
  1::bigint, 'the list shows a public league with its members');
select is((select count(*) from list_public_leagues() where league_id = (select league from priv)),
  0::bigint, 'a private league is not listed');
select is(join_public_league((select league from pub)), (select league from pub),
  'a public league is joined without a code');
select throws_ok($$ select join_public_league((select league from priv)) $$, 'P0002', null,
  'a private league cannot be joined without its code');
select is((select count(*) from leagues where id = (select league from pub)), 1::bigint,
  'a member now sees the public league among his leagues');

-- 200 players at most; a private league keeps its 50 places.
reset role;
insert into auth.users (id, email)
select ('bbbb0000-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid, 'pub-filler-' || n || '@example.test'
from generate_series(1, 198) n;
insert into profiles (id, pseudo, age_confirmed_at)
select ('bbbb0000-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid, 'Public ' || n, now()
from generate_series(1, 198) n;
insert into league_members (league_id, user_id)
select (select league from pub), ('bbbb0000-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid
from generate_series(1, 198) n;
insert into league_members (league_id, user_id)
select (select league from priv), ('bbbb0000-0000-0000-0001-' || lpad(n::text, 12, '0'))::uuid
from generate_series(1, 49) n;
set local role authenticated;
select act_as('bbbb0000-0000-0000-0000-000000000003');
select throws_ok($$ select join_public_league((select league from pub)) $$, '54000', null,
  'the 201st player is refused');
select throws_ok($$ select join_league((select code from priv)) $$, '54000', null,
  'a private league is still full at 50');

select * from finish();
rollback;
