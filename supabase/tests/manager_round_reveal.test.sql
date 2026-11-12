-- pgTAP: the reveal at the end of each round (#604). While a round is open a player reads their
-- own bids only; once it is closed every participant reads every bid of the round, with whether it
-- won; an outsider reads nothing. The reveal is marked as seen once per round and per player.
-- Rolled back at the end.
begin;
select plan(18);

insert into auth.users (id, email) values
  ('a6040000-0000-0000-0000-000000000001', 'one@example.test'),
  ('a6040000-0000-0000-0000-000000000002', 'two@example.test'),
  ('a6040000-0000-0000-0000-000000000003', 'three@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('a6040000-0000-0000-0000-000000000001', 'Revele Une', now()),
  ('a6040000-0000-0000-0000-000000000002', 'Revele Deux', now()),
  ('a6040000-0000-0000-0000-000000000003', 'Revele Trois', now());
insert into athletes (id, slug, name, country_code, gender, manager_price) values
  ('a6040000-0000-0000-0000-0000000000a1', 'revele-une', 'Revele Athlete Une', 'FRA', 'F', 10),
  ('a6040000-0000-0000-0000-0000000000a2', 'revele-deux', 'Revele Athlete Deux', 'FRA', 'M', 10);
insert into athlete_disciplines (athlete_id, discipline, is_primary) values
  ('a6040000-0000-0000-0000-0000000000a1', '100 m', true),
  ('a6040000-0000-0000-0000-0000000000a2', '100 m', true);
insert into manager_leagues (id, name, owner_id, rules, mercato_opened_at) values
  ('a6040000-0000-0000-0000-0000000000f1', 'Revelation', 'a6040000-0000-0000-0000-000000000001',
   '{"budget": 100, "rounds": {"firstHours": 48, "longRounds": 2, "nextHours": 24}}',
   now() - interval '1 hour');
-- Three is not in the league.
insert into manager_members (league_id, user_id) values
  ('a6040000-0000-0000-0000-0000000000f1', 'a6040000-0000-0000-0000-000000000001'),
  ('a6040000-0000-0000-0000-0000000000f1', 'a6040000-0000-0000-0000-000000000002');

create function pg_temp.as_player(p_n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',
    'a6040000-0000-0000-0000-00000000000' || p_n, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_player(int) to authenticated;
create function pg_temp.bid(p_n int, p_athlete int, p_amount int) returns void
language sql as $$
  select pg_temp.as_player(p_n);
  select place_manager_bid('a6040000-0000-0000-0000-0000000000f1',
    ('a6040000-0000-0000-0000-0000000000a' || p_athlete)::uuid, p_amount);
$$;
grant execute on function pg_temp.bid(int, int, int) to authenticated;

-- Round 1: both bid on the first athlete, two alone on the second.
set local role authenticated;
select pg_temp.bid(1, 1, 30);
select pg_temp.bid(2, 1, 20);
select pg_temp.bid(2, 2, 15);
select pg_temp.as_player(2);
select is((select count(*)::int from manager_bids), 2,
  'while the round is open, two reads their own bids only');
select is((select count(*)::int from manager_round_bids), 0, 'nothing is revealed before the close');
reset role;

update manager_leagues set mercato_opened_at = now() - interval '49 hours'
where id = 'a6040000-0000-0000-0000-0000000000f1';
select is(private.close_manager_rounds(), 1, 'the job closes round 1');

-- Round 2 is open, on a third athlete: one bids on it.
update manager_leagues set mercato_opened_at = now() - interval '1 hour'
where id = 'a6040000-0000-0000-0000-0000000000f1';
insert into athletes (id, slug, name, country_code, gender, manager_price) values
  ('a6040000-0000-0000-0000-0000000000a3', 'revele-trois', 'Revele Athlete Trois', 'FRA', 'F', 10);
insert into athlete_disciplines (athlete_id, discipline, is_primary) values
  ('a6040000-0000-0000-0000-0000000000a3', '100 m', true);

set local role authenticated;
select pg_temp.bid(1, 3, 12);

select pg_temp.as_player(2);
select is((select count(*)::int from manager_round_bids where round = 1), 3,
  'once round 1 is closed, two reads every bid of the round');
select results_eq(
  $$select user_id::text, amount, won from manager_round_bids
    where athlete_id = 'a6040000-0000-0000-0000-0000000000a1' order by amount desc$$,
  $$values ('a6040000-0000-0000-0000-000000000001'::text, 30, true),
           ('a6040000-0000-0000-0000-000000000002'::text, 20, false)$$,
  'two sees who bid on the first athlete, how much, and that one got it');
select ok((select won from manager_round_bids
           where athlete_id = 'a6040000-0000-0000-0000-0000000000a2'),
  'the only bid on the second athlete won');
select is((select count(*)::int from manager_bids), 0,
  'two does not read the bid of one in the open round');
select is((select count(*)::int from manager_round_bids where round = 2), 0,
  'nothing of round 2 is revealed while it is open');
select results_eq(
  $$select round, seen from manager_bid_rounds('a6040000-0000-0000-0000-0000000000f1')$$,
  $$values (1, false)$$, 'round 1 has bids to reveal, not seen yet');

select pg_temp.as_player(1);
select is((select count(*)::int from manager_bids), 1, 'one still reads their own open bid');

select pg_temp.as_player(3);
select is((select count(*)::int from manager_round_bids), 0, 'an outsider reads no bid');
select is_empty($$select * from manager_bid_rounds('a6040000-0000-0000-0000-0000000000f1')$$,
  'an outsider sees no round to reveal');
select throws_ok(
  $$select mark_manager_round_revealed('a6040000-0000-0000-0000-0000000000f1', 1)$$,
  '42501', null, 'an outsider marks no reveal');

-- The reveal shows once: two marks round 1 as seen; it never goes back.
select pg_temp.as_player(2);
select is((select revealed_round from manager_members
           where user_id = 'a6040000-0000-0000-0000-000000000002'), 0, 'no reveal seen at first');
select throws_ok(
  $$select mark_manager_round_revealed('a6040000-0000-0000-0000-0000000000f1', 2)$$,
  'P0002', null, 'an open round has no reveal to mark');
select mark_manager_round_revealed('a6040000-0000-0000-0000-0000000000f1', 1);
select is((select revealed_round from manager_members
           where user_id = 'a6040000-0000-0000-0000-000000000002'), 1, 'two saw the reveal of round 1');
select results_eq(
  $$select round, seen from manager_bid_rounds('a6040000-0000-0000-0000-0000000000f1')$$,
  $$values (1, true)$$, 'round 1 does not show again to two');
select is((select revealed_round from manager_members
           where user_id = 'a6040000-0000-0000-0000-000000000001'), 0,
  'one has not seen it yet');
reset role;

select * from finish();
rollback;
