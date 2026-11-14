-- pgTAP: a Manager league closes to newcomers (#781) once its mercato is open, launched by the
-- creator or opened by the job at mercato_starts_at, and once it holds the players its
-- competitions call for (player_target, after a change of competitions too). Every way in is
-- refused (code, link, one tap), closed public leagues leave the list, and the invite status
-- tells the page why. Rolled back at the end.
begin;
select plan(22);

insert into auth.users (id, email)
select ('a781a781-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'c' || n || '@example.test'
from generate_series(1, 9) n;
insert into profiles (id, pseudo, age_confirmed_at)
select ('a781a781-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'Coureur ' || n, now()
from generate_series(1, 9) n;

-- Ten season competitions, far ahead, eligible.
insert into competitions (slug, name, starts_on, ends_on)
select 'tap-closed-' || n, 'Saison ' || n, current_date + 30 + 7 * n, current_date + 30 + 7 * n
from generate_series(1, 10) n;
insert into manager_competitions (competition_id)
select id from competitions where slug like 'tap-closed-%';
create function pg_temp.season(p_count int) returns uuid[] language sql stable as $$
  select array_agg(id order by starts_on) from (
    select id, starts_on from competitions where slug like 'tap-closed-%'
    order by starts_on limit p_count) s
$$;
grant execute on function pg_temp.season(int) to authenticated;

create function pg_temp.as_player(p_n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',
    'a781a781-0000-0000-0000-0000000000' || lpad(p_n::text, 2, '0'),
    'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_player(int) to authenticated;

-- Three public leagues of player 1: launched by hand, opened by the job, its target changed.
set local role authenticated;
select pg_temp.as_player(1);
select create_manager_league('Ligue Lancee', true, pg_temp.season(6));
select create_manager_league('Ligue Programmee', true, pg_temp.season(6));
select create_manager_league('Ligue Elastique', true, pg_temp.season(10));
reset role;
create temp table t_leagues as select id, name, invite_code from manager_leagues
where name in ('Ligue Lancee', 'Ligue Programmee', 'Ligue Elastique');
grant select on t_leagues to authenticated;
create function pg_temp.league(p_name text) returns uuid language sql as $$
  select id from t_leagues where name = p_name
$$;
grant execute on function pg_temp.league(text) to authenticated;
create function pg_temp.code(p_name text) returns text language sql as $$
  select invite_code from t_leagues where name = p_name
$$;
grant execute on function pg_temp.code(text) to authenticated;
create function pg_temp.enter(p_n int, p_name text) returns uuid language sql as $$
  select pg_temp.as_player(p_n);
  select join_manager_league(pg_temp.code(p_name));
$$;
grant execute on function pg_temp.enter(int, text) to authenticated;
create function pg_temp.members(p_name text) returns int language sql as $$
  select count(*)::int from manager_members where league_id = pg_temp.league(p_name)
$$;
create function pg_temp.listed(p_name text) returns boolean language sql as $$
  select exists (select 1 from list_public_manager_leagues() where name = p_name)
$$;
grant execute on function pg_temp.listed(text) to authenticated;
set local role authenticated;

-- The mercato launched by the creator.
select pg_temp.enter(2, 'Ligue Lancee');
select pg_temp.enter(3, 'Ligue Lancee');
select pg_temp.as_player(9);
select is(manager_invite_status(pg_temp.code('Ligue Lancee')), 'open',
  'the invite of a league with a place left is open');
select is(manager_invite_status('ZZZZZZ'), null, 'an unknown code has no status');
select pg_temp.enter(4, 'Ligue Lancee');
select pg_temp.as_player(1);
select launch_manager_mercato(pg_temp.league('Ligue Lancee'));
select pg_temp.as_player(9);
select is(manager_invite_status(pg_temp.code('Ligue Lancee')), 'mercato_open',
  'the invite says the mercato is open once launched');
select is(pg_temp.listed('Ligue Lancee'), false, 'a launched league leaves the public list');
select throws_ok($$select join_manager_league(pg_temp.code('Ligue Lancee'))$$, 'FT015', null,
  'a launched league is not joined with its code or link');
select throws_ok($$select join_public_manager_league(pg_temp.league('Ligue Lancee'))$$, 'FT015',
  null, 'a launched league is not joined in one tap');
select pg_temp.as_player(4);
select is(manager_invite_status(pg_temp.code('Ligue Lancee')), 'open',
  'a participant following the link again is taken to the league');

-- The mercato opened by the job at its time, once the target is reached.
select pg_temp.as_player(1);
select set_manager_mercato(pg_temp.league('Ligue Programmee'), now() - interval '1 minute', 'auto');
select pg_temp.enter(2, 'Ligue Programmee');
select pg_temp.enter(3, 'Ligue Programmee');
select pg_temp.enter(4, 'Ligue Programmee');
select pg_temp.as_player(9);
select is(manager_invite_status(pg_temp.code('Ligue Programmee')), 'full',
  'the invite says the league is full at its target');
select is(pg_temp.listed('Ligue Programmee'), false, 'a full league leaves the public list');
select throws_ok($$select join_manager_league(pg_temp.code('Ligue Programmee'))$$, '54000', null,
  'a full league is not joined with its code');
reset role;
select private.close_manager_rounds();
select isnt((select mercato_opened_at from manager_leagues where id = pg_temp.league('Ligue Programmee')),
  null, 'the job opens the mercato at its time');
set local role authenticated;
select pg_temp.as_player(9);
select is(manager_invite_status(pg_temp.code('Ligue Programmee')), 'mercato_open',
  'the invite says the mercato is open once the job opened it');
select throws_ok($$select join_manager_league(pg_temp.code('Ligue Programmee'))$$, 'FT015', null,
  'a league opened by the job is not joined with its code');
select throws_ok($$select join_public_manager_league(pg_temp.league('Ligue Programmee'))$$,
  'FT015', null, 'a league opened by the job is not joined in one tap');

-- The target follows the competitions: 10 competitions call for 6 players, 6 for 4.
reset role;
select is((select player_target from manager_leagues where id = pg_temp.league('Ligue Elastique')),
  6, '10 competitions: the league waits for 6 players');
set local role authenticated;
select pg_temp.enter(2, 'Ligue Elastique');
select pg_temp.enter(3, 'Ligue Elastique');
select pg_temp.as_player(1);
select set_manager_competitions(pg_temp.league('Ligue Elastique'), pg_temp.season(6));
reset role;
select is((select player_target from manager_leagues where id = pg_temp.league('Ligue Elastique')),
  4, 'back to 6 competitions: the league waits for 4 players');
set local role authenticated;

-- Two players go for the last place: the first takes it, the second is refused.
select is(pg_temp.enter(4, 'Ligue Elastique'), pg_temp.league('Ligue Elastique'),
  'the first of two players takes the last place');
select throws_ok($$select pg_temp.enter(5, 'Ligue Elastique')$$, '54000', null,
  'the second one is refused: the league is full at its new target');
reset role;
select is(pg_temp.members('Ligue Elastique'), 4, 'the league holds exactly its target');
-- Two sessions at the same time wait for each other: the league row is locked before counting.
select matches(pg_get_functiondef('private.enter_manager_league(uuid)'::regprocedure),
  'from manager_leagues where id = p_league for update',
  'joining locks the league row before counting its places');
set local role authenticated;

select pg_temp.as_player(1);
select set_manager_competitions(pg_temp.league('Ligue Elastique'), pg_temp.season(10));
select is(pg_temp.enter(5, 'Ligue Elastique'), pg_temp.league('Ligue Elastique'),
  'more competitions: the league takes a 5th player');
select pg_temp.as_player(9);
select is(pg_temp.listed('Ligue Elastique'), true, 'a league with places again is listed');

select * from finish();
rollback;
