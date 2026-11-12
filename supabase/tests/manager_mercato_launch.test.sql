-- pgTAP: setting and launching the mercato of a Manager league (#619). An even target of 4 to
-- 10 players, never under the players already in; only the creator sets it and launches; launch
-- only once the target is reached; the job opens the mercato at its time if and only if the
-- target is reached; nobody joins once it is open. Rolled back at the end.
begin;
select plan(22);

insert into auth.users (id, email)
select ('a619a619-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'l' || n || '@example.test'
from generate_series(1, 7) n;
insert into profiles (id, pseudo, age_confirmed_at)
select ('a619a619-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'Lanceur ' || n, now()
from generate_series(1, 7) n;

create function pg_temp.as_player(p_n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',
    'a619a619-0000-0000-0000-0000000000' || lpad(p_n::text, 2, '0'),
    'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_player(int) to authenticated;

set local role authenticated;
select pg_temp.as_player(1);
select create_manager_league('Ligue Lancee', false);
select create_manager_league('Ligue Programmee', false);
reset role;
create temp table t_leagues as select id, name, invite_code from manager_leagues
where name in ('Ligue Lancee', 'Ligue Programmee');
grant select on t_leagues to authenticated;
create function pg_temp.league(p_name text) returns uuid language sql as $$
  select id from t_leagues where name = p_name
$$;
grant execute on function pg_temp.league(text) to authenticated;
create function pg_temp.enter(p_n int, p_name text) returns uuid language sql as $$
  select pg_temp.as_player(p_n);
  select join_manager_league((select invite_code from t_leagues where name = p_name));
$$;
grant execute on function pg_temp.enter(int, text) to authenticated;

select is((select player_target from manager_leagues where id = pg_temp.league('Ligue Lancee')), 4,
  'a league waits for 4 players by default');
select is((select round_mode from manager_leagues where id = pg_temp.league('Ligue Lancee')), 'auto',
  'its rounds follow French Track rules by default');

set local role authenticated;
-- The target: even, 4 to 10, set by the creator only.
select pg_temp.as_player(1);
select throws_ok($$select set_manager_mercato(pg_temp.league('Ligue Lancee'), 5, null, 'auto')$$,
  'FT025', null, 'an odd number of players is refused');
select throws_ok($$select set_manager_mercato(pg_temp.league('Ligue Lancee'), 12, null, 'auto')$$,
  'FT025', null, 'more than 10 players is refused');
select throws_ok($$select set_manager_mercato(pg_temp.league('Ligue Lancee'), 2, null, 'auto')$$,
  'FT025', null, 'fewer than 4 players is refused');
select throws_ok(
  $$select set_manager_mercato(pg_temp.league('Ligue Lancee'), 6, null, 'custom', 36, 24)$$,
  '22023', null, 'a round of 36 hours is refused');
select lives_ok(
  $$select set_manager_mercato(pg_temp.league('Ligue Lancee'), 6, null, 'custom', 48, 12)$$,
  'the creator asks for 6 players, a first round of 48 hours then 12 hours');
select is((select rules -> 'rounds' from manager_leagues where id = pg_temp.league('Ligue Lancee')),
  '{"firstHours": 48, "longRounds": 1, "nextHours": 12}'::jsonb,
  'the custom rounds become the rounds of the league');

select pg_temp.enter(2, 'Ligue Lancee');
select pg_temp.enter(3, 'Ligue Lancee');
select pg_temp.enter(4, 'Ligue Lancee');
select pg_temp.enter(5, 'Ligue Lancee');
select pg_temp.as_player(2);
select throws_ok($$select set_manager_mercato(pg_temp.league('Ligue Lancee'), 4, null, 'auto')$$,
  '42501', null, 'another participant does not set the mercato');
select throws_ok($$select launch_manager_mercato(pg_temp.league('Ligue Lancee'))$$,
  '42501', null, 'another participant does not launch it');

select pg_temp.as_player(1);
select throws_ok($$select launch_manager_mercato(pg_temp.league('Ligue Lancee'))$$,
  'FT026', null, 'the creator does not launch with 5 players out of 6');
select throws_ok($$select set_manager_mercato(pg_temp.league('Ligue Lancee'), 4, null, 'auto')$$,
  'FT025', null, 'the target never goes under the players already in');
select lives_ok($$select set_manager_mercato(pg_temp.league('Ligue Lancee'), 6, null, 'auto')$$,
  'back to the French Track rounds');
select is((select rules -> 'rounds' from manager_leagues where id = pg_temp.league('Ligue Lancee')),
  (select rules -> 'rounds' from manager_rules), 'the league takes the rounds of French Track');

select pg_temp.enter(6, 'Ligue Lancee');
select throws_ok($$select pg_temp.enter(7, 'Ligue Lancee')$$, '54000', null,
  'a league is full at its target');
select pg_temp.as_player(1);
select lives_ok($$select launch_manager_mercato(pg_temp.league('Ligue Lancee'))$$,
  'the creator launches the mercato once the 6 players are in');
select isnt((select mercato_opened_at from manager_leagues where id = pg_temp.league('Ligue Lancee')),
  null, 'the mercato is open');
reset role;
select is((select round from private.manager_open_round(pg_temp.league('Ligue Lancee'))), 1,
  'round 1 is open');
set local role authenticated;
select throws_ok($$select set_manager_mercato(pg_temp.league('Ligue Lancee'), 6, null, 'auto')$$,
  'FT015', null, 'the mercato is not set again once open');

-- The job opens a mercato at its time if and only if the target is reached.
select pg_temp.as_player(1);
select set_manager_mercato(pg_temp.league('Ligue Programmee'), 4, now() - interval '1 minute', 'auto');
select pg_temp.enter(2, 'Ligue Programmee');
select pg_temp.enter(3, 'Ligue Programmee');
reset role;
select private.close_manager_rounds();
select is((select mercato_opened_at from manager_leagues where id = pg_temp.league('Ligue Programmee')),
  null, 'past its time, the mercato waits while a player is missing');
set local role authenticated;
select pg_temp.enter(4, 'Ligue Programmee');
reset role;
select private.close_manager_rounds();
select isnt((select mercato_opened_at from manager_leagues where id = pg_temp.league('Ligue Programmee')),
  null, 'the job opens it once the 4 players are in');
set local role authenticated;
select throws_ok($$select pg_temp.enter(7, 'Ligue Programmee')$$, 'FT015', null,
  'nobody joins once the mercato is open');

select * from finish();
rollback;
