-- pgTAP: closing the bidding rounds of the mercato (#423). The highest bid wins, a tie goes to the
-- bid placed first at that amount; the amount is spent, the other bids are freed, an athlete
-- belongs to one team; rounds last 48 h, 48 h then 24 h; running the close again changes nothing.
-- Rolled back at the end.
begin;
select plan(31);

insert into auth.users (id, email) values
  ('a3d00000-0000-0000-0000-000000000001', 'one@example.test'),
  ('a3d00000-0000-0000-0000-000000000002', 'two@example.test'),
  ('a3d00000-0000-0000-0000-000000000003', 'three@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('a3d00000-0000-0000-0000-000000000001', 'Tour Une', now()),
  ('a3d00000-0000-0000-0000-000000000002', 'Tour Deux', now()),
  ('a3d00000-0000-0000-0000-000000000003', 'Tour Trois', now());
-- The Manager is open to the admins only (#615): its players here are admins.
update profiles set is_admin = true where id::text like 'a3d00000-%';
insert into athletes (id, slug, name, country_code, gender, manager_price) values
  ('a3d00000-0000-0000-0000-0000000000a1', 'tour-une', 'Tour Athlete Une', 'FRA', 'F', 10),
  ('a3d00000-0000-0000-0000-0000000000a2', 'tour-deux', 'Tour Athlete Deux', 'FRA', 'M', 20),
  ('a3d00000-0000-0000-0000-0000000000a3', 'tour-trois', 'Tour Athlete Trois', 'FRA', 'F', 10),
  ('a3d00000-0000-0000-0000-0000000000a4', 'tour-quatre', 'Tour Athlete Quatre', 'FRA', 'M', 10);
insert into athlete_disciplines (athlete_id, discipline, is_primary) values
  ('a3d00000-0000-0000-0000-0000000000a1', '100 m', true),
  ('a3d00000-0000-0000-0000-0000000000a2', '100 m', true),
  ('a3d00000-0000-0000-0000-0000000000a3', '100 m', true),
  ('a3d00000-0000-0000-0000-0000000000a4', '100 m', true);
insert into manager_leagues (id, name, owner_id, rules, mercato_opened_at) values
  ('a3d00000-0000-0000-0000-0000000000f1', 'Tours', 'a3d00000-0000-0000-0000-000000000001',
   '{"budget": 100, "rounds": {"firstHours": 48, "longRounds": 2, "nextHours": 24}}',
   now() - interval '1 hour');
insert into manager_members (league_id, user_id) values
  ('a3d00000-0000-0000-0000-0000000000f1', 'a3d00000-0000-0000-0000-000000000001'),
  ('a3d00000-0000-0000-0000-0000000000f1', 'a3d00000-0000-0000-0000-000000000002'),
  ('a3d00000-0000-0000-0000-0000000000f1', 'a3d00000-0000-0000-0000-000000000003');

create function pg_temp.as_player(p_n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',
    'a3d00000-0000-0000-0000-00000000000' || p_n, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_player(int) to authenticated;
create function pg_temp.bid(p_n int, p_athlete int, p_amount int) returns void
language sql as $$
  select pg_temp.as_player(p_n);
  select place_manager_bid('a3d00000-0000-0000-0000-0000000000f1',
    ('a3d00000-0000-0000-0000-0000000000a' || p_athlete)::uuid, p_amount);
$$;
grant execute on function pg_temp.bid(int, int, int) to authenticated;
create function pg_temp.opened_hours_ago(p_hours int) returns void language sql as $$
  update manager_leagues set mercato_opened_at = now() - make_interval(hours => p_hours)
  where id = 'a3d00000-0000-0000-0000-0000000000f1';
$$;

-- Round 1 lasts 48 hours and nothing closes before.
select is((select ends_at from private.manager_open_round('a3d00000-0000-0000-0000-0000000000f1')),
  now() - interval '1 hour' + interval '48 hours', 'round 1 ends 48 hours after the opening');
select is(private.close_manager_rounds(), 0, 'no round is closed before its time');

set local role authenticated;
select lives_ok($$select pg_temp.bid(1, 1, 30)$$, 'one bids 30 on the first athlete');
select lives_ok($$select pg_temp.bid(2, 1, 30)$$, 'two bids 30 on it as well');
select lives_ok($$select pg_temp.bid(3, 1, 25)$$, 'three bids 25 on it');
select lives_ok($$select pg_temp.bid(1, 2, 20)$$, 'one bids 20 on the second athlete');
select lives_ok($$select pg_temp.bid(2, 3, 50)$$, 'two bids 50 on the third athlete');
reset role;
-- Two placed the 30 first (times set by hand, to the microsecond).
update manager_bids set bid_at = '2027-01-01 10:00:00.000002+00'
where user_id = 'a3d00000-0000-0000-0000-000000000001'
  and athlete_id = 'a3d00000-0000-0000-0000-0000000000a1';
update manager_bids set bid_at = '2027-01-01 10:00:00.000001+00'
where user_id = 'a3d00000-0000-0000-0000-000000000002'
  and athlete_id = 'a3d00000-0000-0000-0000-0000000000a1';

-- The time of round 1 is over: bids wait for the close.
select pg_temp.opened_hours_ago(49);
set local role authenticated;
select throws_ok($$select pg_temp.bid(3, 4, 10)$$, 'FT020', null,
  'no bid once the time of the round is over, until it is closed');
reset role;

select is(private.close_manager_rounds(), 1, 'the job closes round 1');
select is((select user_id from manager_awards where athlete_id = 'a3d00000-0000-0000-0000-0000000000a1'),
  'a3d00000-0000-0000-0000-000000000002'::uuid,
  'a tie goes to the bid placed first at that amount');
select is((select amount from manager_awards where athlete_id = 'a3d00000-0000-0000-0000-0000000000a1'),
  30, 'for the amount of the winning bid');
select is((select user_id from manager_awards where athlete_id = 'a3d00000-0000-0000-0000-0000000000a2'),
  'a3d00000-0000-0000-0000-000000000001'::uuid, 'a lone bid wins its athlete');
select is((select count(*)::int from manager_awards), 3, 'every athlete bid on is awarded');
select is((select count(*)::int from manager_bids), 0, 'the losing bids are freed');

-- Running it again closes nothing twice.
select is(private.close_manager_rounds(), 0, 'running the close again closes nothing');
select is((select count(*)::int from manager_awards), 3, 'and awards nothing twice');
select is((select round from private.manager_open_round('a3d00000-0000-0000-0000-0000000000f1')),
  2, 'round 2 is open');
select is((select ends_at from private.manager_open_round('a3d00000-0000-0000-0000-0000000000f1')),
  now() - interval '49 hours' + interval '96 hours', 'round 2 lasts 48 hours as well');

-- The budget: what was won is spent; the losing bids no longer reserve anything.
set local role authenticated;
select throws_ok($$select pg_temp.bid(2, 4, 21)$$, 'FT018', null,
  'two spent 80 of 100: a bid of 21 is over the budget');
select lives_ok($$select pg_temp.bid(2, 4, 20)$$, 'a bid of 20 fits');
select lives_ok($$select pg_temp.bid(1, 4, 80)$$, 'one spent 20 and can bid the 80 left');
select throws_ok($$select pg_temp.bid(3, 1, 40)$$, 'FT019', null,
  'an athlete already won takes no more bids');
select is((select available from manager_catalogue('a3d00000-0000-0000-0000-0000000000f1')
           where athlete_id = 'a3d00000-0000-0000-0000-0000000000a1'),
  false, 'and is no longer available in the catalogue');

-- A player reads their own athletes only, and nobody writes them by hand.
select pg_temp.as_player(2);
select is((select count(*)::int from manager_awards), 2, 'a player reads the athletes they won');
select pg_temp.as_player(3);
select is((select count(*)::int from manager_awards), 0, 'and not those of the others');
select is((select count(*)::int from manager_rounds), 1, 'a participant reads the closed rounds');
select throws_ok($$insert into manager_awards (league_id, athlete_id, user_id, amount, round) values
  ('a3d00000-0000-0000-0000-0000000000f1', 'a3d00000-0000-0000-0000-0000000000a4',
   'a3d00000-0000-0000-0000-000000000003', 10, 1)$$, '42501', null, 'nobody awards by hand');
reset role;

-- Round 2 ends 96 hours after the opening, round 3 24 hours later.
select pg_temp.opened_hours_ago(97);
select is(private.close_manager_rounds(), 1, 'round 2 closes after 96 hours, not round 3');
select is((select user_id from manager_awards where athlete_id = 'a3d00000-0000-0000-0000-0000000000a4'),
  'a3d00000-0000-0000-0000-000000000001'::uuid, 'the highest bid wins');
select is((select round from manager_awards where athlete_id = 'a3d00000-0000-0000-0000-0000000000a4'),
  2, 'in round 2');
select pg_temp.opened_hours_ago(121);
select is(private.close_manager_rounds(), 1, 'round 3 lasts 24 hours');

select * from finish();
rollback;
