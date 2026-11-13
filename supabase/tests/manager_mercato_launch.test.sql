-- pgTAP: creating, setting and launching the mercato of a Manager league (#619, #644). The
-- creator picks 6 competitions at least, open to the Manager and not over; the number of
-- players follows (2 × (N − 1) matchdays, the rest bonus). Only the creator sets the mercato and
-- launches it; launch only once the players are all in and enough competitions start 1 h after
-- the expected end of the mercato; the job opens the mercato at its time on the same terms;
-- nobody joins once it is open. Rolled back at the end.
begin;
select plan(29);

insert into auth.users (id, email)
select ('a619a619-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'l' || n || '@example.test'
from generate_series(1, 7) n;
insert into profiles (id, pseudo, age_confirmed_at)
select ('a619a619-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'Lanceur ' || n, now()
from generate_series(1, 7) n;

-- Ten competitions open to the Manager, a week apart from 30 days on; one over; one not open to
-- the Manager; one whose first event is tomorrow.
insert into competitions (slug, name, starts_on, ends_on, status)
select 'pgtap-launch-' || n, 'Meeting ' || n, current_date + 30 + 7 * n, current_date + 30 + 7 * n,
       'upcoming'
from generate_series(1, 10) n;
insert into competitions (slug, name, starts_on, ends_on, status) values
  ('pgtap-launch-over', 'Meeting fini', current_date - 10, current_date - 10, 'finished'),
  ('pgtap-launch-other', 'Meeting hors Manager', current_date + 40, current_date + 40, 'upcoming'),
  ('pgtap-launch-soon', 'Meeting demain', current_date + 1, current_date + 1, 'upcoming');
insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
select id, 'soon-100', '100 m', 'F', now() + interval '1 day', now() + interval '1 day'
from competitions where slug = 'pgtap-launch-soon';
insert into manager_competitions (competition_id)
select id from competitions where slug like 'pgtap-launch-%' and slug <> 'pgtap-launch-other';
create temp table t_competitions as
select id, slug from competitions where slug like 'pgtap-launch-%';
grant select on t_competitions to authenticated;
-- The first `p_count` of the ten competitions a week apart, plus `p_extra` slugs.
create function pg_temp.picked(p_count int, p_extra text[] default '{}') returns uuid[]
language sql as $$
  select array_agg(id) from t_competitions
  where (slug ~ '^pgtap-launch-[0-9]+$' and substring(slug from '[0-9]+$')::int <= p_count)
     or slug = any(p_extra)
$$;
grant execute on function pg_temp.picked(int, text[]) to authenticated;

create function pg_temp.as_player(p_n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',
    'a619a619-0000-0000-0000-0000000000' || lpad(p_n::text, 2, '0'),
    'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_player(int) to authenticated;

set local role authenticated;
select pg_temp.as_player(1);
-- The competitions: 6 at least, open to the Manager, not over.
select throws_ok($$select create_manager_league('Trop Peu', false, pg_temp.picked(5))$$,
  'FT027', null, 'fewer than 6 competitions are refused');
select throws_ok(
  $$select create_manager_league('Trop Tard', false,
                                 pg_temp.picked(5, array['pgtap-launch-over']))$$,
  'FT027', null, 'a competition already over is refused');
select throws_ok(
  $$select create_manager_league('Hors Manager', false,
                                 pg_temp.picked(5, array['pgtap-launch-other']))$$,
  'FT027', null, 'a competition not open to the Manager is refused');
select is((select count(*)::int from list_open_manager_competitions()
           where competition_id in (select id from t_competitions)), 11,
  'the open list holds the competitions open to the Manager and not over');

select create_manager_league('Ligue Lancee', false, pg_temp.picked(10));
select create_manager_league('Ligue Programmee', false, pg_temp.picked(6));
select create_manager_league('Ligue Bonus', false, pg_temp.picked(8));
select create_manager_league('Ligue Courte', false, pg_temp.picked(5, array['pgtap-launch-soon']));
reset role;
create temp table t_leagues as select id, name, invite_code from manager_leagues
where name like 'Ligue %';
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

select is((select player_target from manager_leagues where id = pg_temp.league('Ligue Lancee')), 6,
  '10 competitions make a league of 6 players');
select is((select player_target from manager_leagues where id = pg_temp.league('Ligue Programmee')),
  4, '6 competitions make a league of 4 players');
select is((select player_target from manager_leagues where id = pg_temp.league('Ligue Bonus')), 4,
  '8 competitions make a league of 4 players, 2 of them bonus');
select is((select cardinality(competition_ids) from manager_leagues
           where id = pg_temp.league('Ligue Bonus')), 8, 'the league keeps its 8 competitions');
select is((select round_mode from manager_leagues where id = pg_temp.league('Ligue Lancee')), 'auto',
  'its rounds follow French Track rules by default');

set local role authenticated;
select pg_temp.as_player(1);
select is((select count(*)::int from manager_league_competitions(pg_temp.league('Ligue Bonus'))), 8,
  'its participants read its competitions');
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
select is((select count(*)::int from manager_league_competitions(pg_temp.league('Ligue Bonus'))), 0,
  'another player does not read the competitions of a league they are not in');
select throws_ok($$select set_manager_mercato(pg_temp.league('Ligue Lancee'), null, 'auto')$$,
  '42501', null, 'another participant does not set the mercato');
select throws_ok($$select launch_manager_mercato(pg_temp.league('Ligue Lancee'))$$,
  '42501', null, 'another participant does not launch it');

select pg_temp.as_player(1);
select throws_ok($$select launch_manager_mercato(pg_temp.league('Ligue Lancee'))$$,
  'FT026', null, 'the creator does not launch with 5 players out of 6');
select lives_ok($$select set_manager_mercato(pg_temp.league('Ligue Lancee'), null, 'auto')$$,
  'back to the French Track rounds');
select is((select rules -> 'rounds' from manager_leagues where id = pg_temp.league('Ligue Lancee')),
  (select rules -> 'rounds' from manager_rules), 'the league takes the rounds of French Track');

select pg_temp.enter(6, 'Ligue Lancee');
select throws_ok($$select pg_temp.enter(7, 'Ligue Lancee')$$, '54000', null,
  'a league is full at its number of players');
select pg_temp.as_player(1);
select lives_ok($$select launch_manager_mercato(pg_temp.league('Ligue Lancee'))$$,
  'the creator launches the mercato once the 6 players are in');
select isnt((select mercato_opened_at from manager_leagues where id = pg_temp.league('Ligue Lancee')),
  null, 'the mercato is open');
reset role;
select is((select round from private.manager_open_round(pg_temp.league('Ligue Lancee'))), 1,
  'round 1 is open');
set local role authenticated;
select throws_ok($$select set_manager_mercato(pg_temp.league('Ligue Lancee'), null, 'auto')$$,
  'FT015', null, 'the mercato is not set again once open');

-- A competition starting before the mercato is over does not count: 5 left for 4 players.
select pg_temp.enter(2, 'Ligue Courte');
select pg_temp.enter(3, 'Ligue Courte');
select pg_temp.enter(4, 'Ligue Courte');
select pg_temp.as_player(1);
select throws_ok($$select launch_manager_mercato(pg_temp.league('Ligue Courte'))$$,
  'FT028', null, 'the mercato does not open while too few competitions are left');
select set_manager_mercato(pg_temp.league('Ligue Courte'), now() - interval '1 minute', 'auto');

-- The job opens a mercato at its time if and only if the players are in and enough
-- competitions are left.
select set_manager_mercato(pg_temp.league('Ligue Programmee'), now() - interval '1 minute', 'auto');
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
select is((select mercato_opened_at from manager_leagues where id = pg_temp.league('Ligue Courte')),
  null, 'the job does not open a mercato too few competitions are left for');
set local role authenticated;
select throws_ok($$select pg_temp.enter(7, 'Ligue Programmee')$$, 'FT015', null,
  'nobody joins once the mercato is open');

select * from finish();
rollback;
