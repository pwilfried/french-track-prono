-- pgTAP: French Track Manager is open to the admins only (#615). A player who is not an admin
-- creates no Manager league, joins none, bids on nobody, closes no mercato, lines up nobody and
-- marks no reveal (FT025), even when already in a league (from v0.14.0); an admin does.
-- Rolled back at the end.
begin;
select plan(14);

insert into auth.users (id, email) values
  ('a0a00000-0000-0000-0000-000000000001', 'admin-one@example.test'),
  ('a0a00000-0000-0000-0000-000000000002', 'admin-two@example.test'),
  ('a0a00000-0000-0000-0000-000000000003', 'player@example.test');
insert into profiles (id, pseudo, age_confirmed_at, is_admin) values
  ('a0a00000-0000-0000-0000-000000000001', 'Admin Une', now(), true),
  ('a0a00000-0000-0000-0000-000000000002', 'Admin Deux', now(), true),
  ('a0a00000-0000-0000-0000-000000000003', 'Joueur Simple', now(), false);
insert into athletes (id, slug, name, country_code, gender, manager_price) values
  ('a0a00000-0000-0000-0000-0000000000a1', 'ouvert-une', 'Ouvert Une', 'FRA', 'F', 10);
insert into athlete_disciplines (athlete_id, discipline, is_primary) values
  ('a0a00000-0000-0000-0000-0000000000a1', '100 m', true);
-- A league of v0.14.0 with its mercato open, the player already in it.
insert into manager_leagues (id, name, owner_id, rules, mercato_opened_at) values
  ('a0a00000-0000-0000-0000-0000000000f1', 'Deja La', 'a0a00000-0000-0000-0000-000000000001',
   '{"budget": 100}', now() - interval '1 minute');
insert into manager_members (league_id, user_id) values
  ('a0a00000-0000-0000-0000-0000000000f1', 'a0a00000-0000-0000-0000-000000000001'),
  ('a0a00000-0000-0000-0000-0000000000f1', 'a0a00000-0000-0000-0000-000000000003');

create function pg_temp.as_user(p_n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',
    'a0a00000-0000-0000-0000-00000000000' || p_n, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_user(int) to authenticated;

set local role authenticated;

-- Creating a league.
select pg_temp.as_user(3);
select throws_ok($$select create_manager_league('Pas Pour Moi', true)$$, 'FT025', null,
  'a player who is not an admin creates no Manager league');
select pg_temp.as_user(1);
select lives_ok($$select create_manager_league('Les Ouverts', true)$$,
  'an admin creates a Manager league');

reset role;
create temp table t_new as select id, invite_code from manager_leagues where name = 'Les Ouverts';
grant select on t_new to authenticated;
set local role authenticated;

-- Joining one, with its code or in one tap.
select pg_temp.as_user(3);
select throws_ok($$select join_manager_league((select invite_code from t_new))$$, 'FT025', null,
  'a player who is not an admin joins no league with its code');
select throws_ok($$select join_public_manager_league((select id from t_new))$$, 'FT025', null,
  'nor a public league in one tap');
select pg_temp.as_user(2);
select is((select join_manager_league((select invite_code from t_new))), (select id from t_new),
  'an admin joins a league with its code');

-- Bidding, even in a league the player is already in.
select pg_temp.as_user(3);
select throws_ok($$select place_manager_bid('a0a00000-0000-0000-0000-0000000000f1',
  'a0a00000-0000-0000-0000-0000000000a1', 10)$$, 'FT025', null,
  'a player who is not an admin bids on nobody, even in their league');
select throws_ok($$select withdraw_manager_bid('a0a00000-0000-0000-0000-0000000000f1',
  'a0a00000-0000-0000-0000-0000000000a1')$$, 'FT025', null, 'nor withdraws a bid');
select throws_ok($$select close_manager_mercato('a0a00000-0000-0000-0000-0000000000f1')$$,
  'FT025', null, 'nor closes the mercato');
select pg_temp.as_user(1);
select lives_ok($$select place_manager_bid('a0a00000-0000-0000-0000-0000000000f1',
  'a0a00000-0000-0000-0000-0000000000a1', 10)$$, 'an admin bids');

-- Lining up and seeing a reveal.
select pg_temp.as_user(3);
select throws_ok($$select save_manager_lineup('a0a00000-0000-0000-0000-0000000000f1',
  gen_random_uuid(), '{}')$$, 'FT025', null, 'a player who is not an admin lines up nobody');
select throws_ok($$select mark_manager_round_revealed('a0a00000-0000-0000-0000-0000000000f1', 1)$$,
  'FT025', null, 'nor marks a reveal seen');
select pg_temp.as_user(1);
-- Past the gate, the admin meets the rules of the lineup: not a competition of the league.
select throws_ok($$select save_manager_lineup('a0a00000-0000-0000-0000-0000000000f1',
  gen_random_uuid(), '{}')$$, 'P0002', null,
  'an admin goes on to the rules of the lineup');

-- An outsider still gets 42501 first, admin or not.
select pg_temp.as_user(2);
select throws_ok($$select place_manager_bid('a0a00000-0000-0000-0000-0000000000f1',
  'a0a00000-0000-0000-0000-0000000000a1', 10)$$, '42501', null,
  'an admin outside the league bids on nobody');

reset role;
select is((select count(*)::int from manager_bids
           where user_id = 'a0a00000-0000-0000-0000-000000000003'), 0,
  'the player who is not an admin left no bid');

select * from finish();
rollback;
