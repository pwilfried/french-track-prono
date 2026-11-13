-- pgTAP: the competitions and the mercato of a Manager league (#619, #644). The creator chooses
-- at least 6 available competitions (eligible, not finished); the number of players follows
-- (2 × (N − 1) ≤ competitions), never under the players already in. Only the creator sets the
-- competitions and the mercato, and launches it; launch only once the target is reached and
-- enough competitions start at least 1 hour after the planned end of the mercato; the job opens
-- the mercato at its time on the same conditions; nobody joins once it is open. Rolled back.
begin;
select plan(33);

insert into auth.users (id, email)
select ('a619a619-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'l' || n || '@example.test'
from generate_series(1, 7) n;
insert into profiles (id, pseudo, age_confirmed_at)
select ('a619a619-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'Lanceur ' || n, now()
from generate_series(1, 7) n;

-- Ten season competitions, far ahead, eligible; one tomorrow; one finished; one not eligible.
insert into competitions (slug, name, starts_on, ends_on, status)
select 'tap-season-' || n, 'Saison ' || n, current_date + 30 + 7 * n, current_date + 30 + 7 * n,
       'upcoming'::event_status
from generate_series(1, 10) n
union all select 'tap-soon', 'Demain', current_date + 1, current_date + 1, 'upcoming'
union all select 'tap-finished', 'Finie', current_date + 30, current_date + 30, 'finished'
union all select 'tap-other', 'Pas eligible', current_date + 30, current_date + 30, 'upcoming';
insert into manager_competitions (competition_id)
select id from competitions where slug like 'tap-season-%' or slug in ('tap-soon', 'tap-finished');
create function pg_temp.season(p_count int) returns uuid[] language sql stable as $$
  select array_agg(id order by starts_on) from (
    select id, starts_on from competitions where slug like 'tap-season-%'
    order by starts_on limit p_count) s
$$;
grant execute on function pg_temp.season(int) to authenticated;
create function pg_temp.comp(p_slug text) returns uuid language sql stable as $$
  select id from competitions where slug = p_slug
$$;
grant execute on function pg_temp.comp(text) to authenticated;

create function pg_temp.as_player(p_n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',
    'a619a619-0000-0000-0000-0000000000' || lpad(p_n::text, 2, '0'),
    'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_player(int) to authenticated;

set local role authenticated;
select pg_temp.as_player(1);
-- The competitions available: eligible and not finished, first one first.
select is((select array_agg(competition_id) from list_manager_available_competitions()),
  array[pg_temp.comp('tap-soon')] || pg_temp.season(10),
  'the competitions available are the eligible ones not finished, first one first');
select throws_ok($$select create_manager_league('Trop Courte', false, pg_temp.season(5))$$,
  'FT027', null, 'a league of 5 competitions is refused');
select throws_ok(
  $$select create_manager_league('Finie', false, pg_temp.season(5) || pg_temp.comp('tap-finished'))$$,
  'FT027', null, 'a finished competition is refused');
select throws_ok(
  $$select create_manager_league('Autre', false, pg_temp.season(5) || pg_temp.comp('tap-other'))$$,
  'FT027', null, 'a competition that is not eligible is refused');
select throws_ok(
  $$select create_manager_league('Double', false, pg_temp.season(5) || pg_temp.season(1))$$,
  'FT027', null, 'a competition chosen twice counts once');

select create_manager_league('Ligue Lancee', false, pg_temp.season(10));
select create_manager_league('Ligue Programmee', false, pg_temp.season(8));
select create_manager_league('Ligue Pressee', false,
  pg_temp.season(5) || pg_temp.comp('tap-soon'));
reset role;
create temp table t_leagues as select id, name, invite_code from manager_leagues
where name in ('Ligue Lancee', 'Ligue Programmee', 'Ligue Pressee');
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
create function pg_temp.target(p_name text) returns int language sql as $$
  select player_target from manager_leagues where id = pg_temp.league(p_name)
$$;

select is(pg_temp.target('Ligue Lancee'), 6, '10 competitions: 6 players');
select is(pg_temp.target('Ligue Programmee'), 4, '8 competitions: 4 players, 2 bonus matchdays');
select is((select competition_ids from manager_leagues where id = pg_temp.league('Ligue Pressee')),
  array[pg_temp.comp('tap-soon')] || pg_temp.season(5),
  'the competitions of a league are kept first one first');
select is((select round_mode from manager_leagues where id = pg_temp.league('Ligue Lancee')), 'auto',
  'its rounds follow French Track rules by default');

set local role authenticated;
-- The competitions: changed by the creator only, the target follows.
select pg_temp.as_player(1);
select lives_ok(
  $$select set_manager_competitions(pg_temp.league('Ligue Lancee'), pg_temp.season(6))$$,
  'the creator keeps 6 competitions');
reset role;
select is(pg_temp.target('Ligue Lancee'), 4, 'the league now waits for 4 players');
set local role authenticated;
select lives_ok(
  $$select set_manager_competitions(pg_temp.league('Ligue Lancee'), pg_temp.season(10))$$,
  'the creator adds 4 competitions');
reset role;
select is(pg_temp.target('Ligue Lancee'), 6, 'the league waits for 6 players again');
set local role authenticated;
select throws_ok(
  $$select set_manager_competitions(pg_temp.league('Ligue Lancee'), pg_temp.season(5))$$,
  'FT027', null, 'fewer than 6 competitions are refused');

-- The rounds.
select throws_ok(
  $$select set_manager_mercato(pg_temp.league('Ligue Lancee'), null, 'custom', 36, 24)$$,
  '22023', null, 'a round of 36 hours is refused');
select lives_ok(
  $$select set_manager_mercato(pg_temp.league('Ligue Lancee'), null, 'custom', 48, 12)$$,
  'the creator asks for a first round of 48 hours then 12 hours');
select is((select rules -> 'rounds' from manager_leagues where id = pg_temp.league('Ligue Lancee')),
  '{"firstHours": 48, "longRounds": 1, "nextHours": 12}'::jsonb,
  'the custom rounds become the rounds of the league');

select pg_temp.enter(2, 'Ligue Lancee');
select pg_temp.enter(3, 'Ligue Lancee');
select pg_temp.enter(4, 'Ligue Lancee');
select pg_temp.enter(5, 'Ligue Lancee');
select pg_temp.as_player(2);
select throws_ok($$select set_manager_mercato(pg_temp.league('Ligue Lancee'), null, 'auto')$$,
  '42501', null, 'another participant does not set the mercato');
select throws_ok(
  $$select set_manager_competitions(pg_temp.league('Ligue Lancee'), pg_temp.season(6))$$,
  '42501', null, 'another participant does not choose the competitions');
select throws_ok($$select launch_manager_mercato(pg_temp.league('Ligue Lancee'))$$,
  '42501', null, 'another participant does not launch it');

select pg_temp.as_player(1);
select throws_ok($$select launch_manager_mercato(pg_temp.league('Ligue Lancee'))$$,
  'FT026', null, 'the creator does not launch with 5 players out of 6');
select throws_ok(
  $$select set_manager_competitions(pg_temp.league('Ligue Lancee'), pg_temp.season(8))$$,
  'FT027', null, 'the players never go under the players already in');
select lives_ok($$select set_manager_mercato(pg_temp.league('Ligue Lancee'), null, 'auto')$$,
  'back to the French Track rounds');
select is((select rules -> 'rounds' from manager_leagues where id = pg_temp.league('Ligue Lancee')),
  (select rules -> 'rounds' from manager_rules), 'the league takes the rounds of French Track');

select pg_temp.enter(6, 'Ligue Lancee');
select throws_ok($$select pg_temp.enter(7, 'Ligue Lancee')$$, '54000', null,
  'a league is full at its target');
select pg_temp.as_player(1);
select lives_ok($$select launch_manager_mercato(pg_temp.league('Ligue Lancee'))$$,
  'the creator launches the mercato once the 6 players are in');
reset role;
select is((select round from private.manager_open_round(pg_temp.league('Ligue Lancee'))), 1,
  'round 1 is open');
set local role authenticated;
select throws_ok($$select set_manager_mercato(pg_temp.league('Ligue Lancee'), null, 'auto')$$,
  'FT015', null, 'the mercato is not set again once open');

-- A competition tomorrow does not count: the mercato ends after it.
select pg_temp.enter(2, 'Ligue Pressee');
select pg_temp.enter(3, 'Ligue Pressee');
select pg_temp.enter(4, 'Ligue Pressee');
select pg_temp.as_player(1);
select throws_ok($$select launch_manager_mercato(pg_temp.league('Ligue Pressee'))$$,
  'FT028', null, 'no launch while too few competitions start after the mercato');

-- The job opens a mercato at its time if and only if the target is reached and enough
-- competitions start after it.
select set_manager_mercato(pg_temp.league('Ligue Pressee'), now() - interval '1 minute', 'auto');
select set_manager_mercato(pg_temp.league('Ligue Programmee'), now() - interval '1 minute', 'auto');
select pg_temp.enter(2, 'Ligue Programmee');
select pg_temp.enter(3, 'Ligue Programmee');
reset role;
select private.close_manager_rounds();
select is((select mercato_opened_at from manager_leagues where id = pg_temp.league('Ligue Programmee')),
  null, 'past its time, the mercato waits while a player is missing');
select is((select mercato_opened_at from manager_leagues where id = pg_temp.league('Ligue Pressee')),
  null, 'past its time, the mercato waits while too few competitions start after it');
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
