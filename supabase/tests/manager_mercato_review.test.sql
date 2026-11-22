-- pgTAP: the finished mercato, read again round by round (#1089). Every participant reads every bid
-- of every closed round, with whether it won; never a bid of a round still open; an outsider reads
-- nothing; nobody writes the revealed bids. Rolled back at the end.
begin;
select plan(10);

insert into auth.users (id, email) values
  ('a1089000-0000-0000-0000-000000000001', 'one@example.test'),
  ('a1089000-0000-0000-0000-000000000002', 'two@example.test'),
  ('a1089000-0000-0000-0000-000000000003', 'three@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('a1089000-0000-0000-0000-000000000001', 'Revue Une', now()),
  ('a1089000-0000-0000-0000-000000000002', 'Revue Deux', now()),
  ('a1089000-0000-0000-0000-000000000003', 'Revue Trois', now());
insert into athletes (id, slug, name, country_code, gender, manager_price) values
  ('a1089000-0000-0000-0000-0000000000a1', 'revue-une', 'Revue Athlete Une', 'FRA', 'F', 10),
  ('a1089000-0000-0000-0000-0000000000a2', 'revue-deux', 'Revue Athlete Deux', 'FRA', 'M', 10),
  ('a1089000-0000-0000-0000-0000000000a3', 'revue-trois', 'Revue Athlete Trois', 'FRA', 'F', 10);
insert into athlete_disciplines (athlete_id, discipline, is_primary) values
  ('a1089000-0000-0000-0000-0000000000a1', '100 m', true),
  ('a1089000-0000-0000-0000-0000000000a2', '100 m', true),
  ('a1089000-0000-0000-0000-0000000000a3', '800 m', true);
insert into manager_leagues (id, name, owner_id, rules, mercato_opened_at) values
  ('a1089000-0000-0000-0000-0000000000f1', 'Revue', 'a1089000-0000-0000-0000-000000000001',
   '{"budget": 100, "rounds": {"firstHours": 48, "longRounds": 1, "nextHours": 24}}',
   now() - interval '1 hour');
-- Three is not in the league.
insert into manager_members (league_id, user_id) values
  ('a1089000-0000-0000-0000-0000000000f1', 'a1089000-0000-0000-0000-000000000001'),
  ('a1089000-0000-0000-0000-0000000000f1', 'a1089000-0000-0000-0000-000000000002');

create function pg_temp.as_player(p_n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',
    'a1089000-0000-0000-0000-00000000000' || p_n, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_player(int) to authenticated;
create function pg_temp.bid(p_n int, p_athlete int, p_amount int) returns void
language sql as $$
  select pg_temp.as_player(p_n);
  select place_manager_bid('a1089000-0000-0000-0000-0000000000f1',
    ('a1089000-0000-0000-0000-0000000000a' || p_athlete)::uuid, p_amount);
$$;
grant execute on function pg_temp.bid(int, int, int) to authenticated;

-- Round 1: both bid on the first athlete, two alone on the second; then it closes.
set local role authenticated;
select pg_temp.bid(1, 1, 30);
select pg_temp.bid(2, 1, 20);
select pg_temp.bid(2, 2, 15);
reset role;
update manager_leagues set mercato_opened_at = now() - interval '49 hours'
where id = 'a1089000-0000-0000-0000-0000000000f1';
select private.close_manager_rounds();

-- Round 2 is open: both bid on the third athlete.
set local role authenticated;
select pg_temp.bid(1, 3, 12);
select pg_temp.bid(2, 3, 18);

select pg_temp.as_player(1);
select is((select count(*)::int from manager_round_bids where round = 2), 0,
  'while round 2 is open, one reads none of its bids');
select results_eq(
  $$select round from manager_bid_rounds('a1089000-0000-0000-0000-0000000000f1')$$,
  $$values (1)$$, 'only the closed round is offered for review');
reset role;

-- Round 2 closes too.
update manager_leagues set mercato_opened_at = now() - interval '73 hours'
where id = 'a1089000-0000-0000-0000-0000000000f1';
select private.close_manager_rounds();

set local role authenticated;
select pg_temp.as_player(1);
select results_eq(
  $$select round from manager_bid_rounds('a1089000-0000-0000-0000-0000000000f1')$$,
  $$values (1), (2)$$, 'once closed, both rounds are offered for review, in order');
select results_eq(
  $$select round, user_id::text, athlete_id::text, amount, won from manager_round_bids
    order by round, athlete_id, amount desc$$,
  $$values
    (1, 'a1089000-0000-0000-0000-000000000001'::text, 'a1089000-0000-0000-0000-0000000000a1'::text, 30, true),
    (1, 'a1089000-0000-0000-0000-000000000002'::text, 'a1089000-0000-0000-0000-0000000000a1'::text, 20, false),
    (1, 'a1089000-0000-0000-0000-000000000002'::text, 'a1089000-0000-0000-0000-0000000000a2'::text, 15, true),
    (2, 'a1089000-0000-0000-0000-000000000002'::text, 'a1089000-0000-0000-0000-0000000000a3'::text, 18, true),
    (2, 'a1089000-0000-0000-0000-000000000001'::text, 'a1089000-0000-0000-0000-0000000000a3'::text, 12, false)$$,
  'one reads every bid of every round, who bid, how much and who won');

select pg_temp.as_player(2);
select is((select count(*)::int from manager_round_bids), 5,
  'two reads the same bids of the whole mercato');

select pg_temp.as_player(3);
select is((select count(*)::int from manager_round_bids), 0, 'an outsider reads no bid');
select is_empty($$select * from manager_bid_rounds('a1089000-0000-0000-0000-0000000000f1')$$,
  'an outsider is offered no round');

select pg_temp.as_player(1);
select throws_ok(
  $$insert into manager_round_bids (league_id, round, user_id, athlete_id, amount, bid_at, won)
    values ('a1089000-0000-0000-0000-0000000000f1', 1, 'a1089000-0000-0000-0000-000000000001',
            'a1089000-0000-0000-0000-0000000000a2', 99, now(), true)$$,
  '42501', null, 'a participant adds no bid to the history');
select throws_ok(
  $$update manager_round_bids set amount = 1$$,
  '42501', null, 'a participant changes no amount of the history');
select throws_ok(
  $$delete from manager_round_bids$$,
  '42501', null, 'a participant deletes no bid of the history');
reset role;

select * from finish();
rollback;
