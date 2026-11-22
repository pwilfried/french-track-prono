-- pgTAP: closing a mercato round early (#1084). A participant says they finished the open round:
-- only for themselves, only while the round is open; they bid no more until the next round. Once
-- every participant did, the round closes at once and the next one lasts its planned length from
-- there; after the last planned round the mercato ends. Rolled back at the end.
begin;
select plan(35);

insert into auth.users (id, email) values
  ('f1d00000-0000-0000-0000-000000000001', 'one@example.test'),
  ('f1d00000-0000-0000-0000-000000000002', 'two@example.test'),
  ('f1d00000-0000-0000-0000-000000000003', 'outsider@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('f1d00000-0000-0000-0000-000000000001', 'Fini Une', now()),
  ('f1d00000-0000-0000-0000-000000000002', 'Fini Deux', now()),
  ('f1d00000-0000-0000-0000-000000000003', 'Fini Dehors', now());
insert into athletes (id, slug, name, country_code, gender, manager_price) values
  ('f1d00000-0000-0000-0000-0000000000a1', 'fini-une', 'Fini Athlete Une', 'FRA', 'F', 10),
  ('f1d00000-0000-0000-0000-0000000000a2', 'fini-deux', 'Fini Athlete Deux', 'FRA', 'M', 20);
insert into athlete_disciplines (athlete_id, discipline, is_primary) values
  ('f1d00000-0000-0000-0000-0000000000a1', '100 m', true),
  ('f1d00000-0000-0000-0000-0000000000a2', '100 m', true);
-- f1: open for an hour, rounds of 48 h then 24 h. f2: not open yet.
insert into manager_leagues (id, name, owner_id, rules, mercato_opened_at) values
  ('f1d00000-0000-0000-0000-0000000000f1', 'Fini', 'f1d00000-0000-0000-0000-000000000001',
   '{"budget": 100, "rounds": {"firstHours": 48, "longRounds": 1, "nextHours": 24},
     "closeModes": ["last_bidder"]}',
   now() - interval '1 hour'),
  ('f1d00000-0000-0000-0000-0000000000f2', 'Pas fini', 'f1d00000-0000-0000-0000-000000000001',
   '{"budget": 100, "rounds": {"firstHours": 48, "longRounds": 1, "nextHours": 24},
     "closeModes": ["last_bidder"]}',
   null);
insert into manager_members (league_id, user_id) values
  ('f1d00000-0000-0000-0000-0000000000f1', 'f1d00000-0000-0000-0000-000000000001'),
  ('f1d00000-0000-0000-0000-0000000000f1', 'f1d00000-0000-0000-0000-000000000002'),
  ('f1d00000-0000-0000-0000-0000000000f2', 'f1d00000-0000-0000-0000-000000000001');

create function pg_temp.as_player(p_n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',
    'f1d00000-0000-0000-0000-00000000000' || p_n, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_player(int) to authenticated;
create function pg_temp.finish(p_n int) returns void language sql as $$
  select pg_temp.as_player(p_n);
  select finish_manager_round('f1d00000-0000-0000-0000-0000000000f1');
$$;
grant execute on function pg_temp.finish(int) to authenticated;
create function pg_temp.bid(p_n int, p_athlete int, p_amount int) returns void
language sql as $$
  select pg_temp.as_player(p_n);
  select place_manager_bid('f1d00000-0000-0000-0000-0000000000f1',
    ('f1d00000-0000-0000-0000-0000000000a' || p_athlete)::uuid, p_amount);
$$;
grant execute on function pg_temp.bid(int, int, int) to authenticated;
create function pg_temp.progress(p_n int)
returns table (round int, ends_at timestamptz, done boolean, finished int, members int)
language sql as $$
  select pg_temp.as_player(p_n);
  select * from manager_round_progress('f1d00000-0000-0000-0000-0000000000f1');
$$;
grant execute on function pg_temp.progress(int) to authenticated;

set local role authenticated;

-- Only a participant, only while the mercato is open, only while the round is.
select pg_temp.as_player(3);
select throws_ok($$select finish_manager_round('f1d00000-0000-0000-0000-0000000000f1')$$,
  '42501', null, 'an outsider finishes no round');
select is((select count(*)::int from pg_temp.progress(3)), 0,
  'an outsider reads no progress of the round');
select pg_temp.as_player(1);
select throws_ok($$select finish_manager_round('f1d00000-0000-0000-0000-0000000000f2')$$,
  'FT016', null, 'nobody finishes a round before the mercato opens');
select is((select count(*)::int from manager_round_progress('f1d00000-0000-0000-0000-0000000000f2')),
  0, 'a mercato not open yet has no round under way');

reset role;
update manager_leagues set mercato_opened_at = now() - interval '49 hours'
where id = 'f1d00000-0000-0000-0000-0000000000f2';
set local role authenticated;
select pg_temp.as_player(1);
select throws_ok($$select finish_manager_round('f1d00000-0000-0000-0000-0000000000f2')$$,
  'FT020', null, 'nobody finishes a round whose time is over: the job closes it');

-- A player marks themselves only, through the function.
select throws_ok($$insert into manager_round_done (league_id, round, user_id)
  values ('f1d00000-0000-0000-0000-0000000000f1', 1, 'f1d00000-0000-0000-0000-000000000002')$$,
  '42501', null, 'nobody writes the table of the finished rounds directly');

-- One bids, then finishes round 1: no more bids nor withdrawals from them in this round.
select lives_ok($$select pg_temp.bid(1, 1, 30)$$, 'one bids 30 on the first athlete');
select lives_ok($$select pg_temp.finish(1)$$, 'one finishes round 1');
select lives_ok($$select pg_temp.finish(1)$$, 'saying it twice changes nothing');
select throws_ok($$select pg_temp.bid(1, 2, 20)$$, 'FT044', null,
  'a player who finished the round bids no more');
select pg_temp.as_player(1);
select throws_ok($$select withdraw_manager_bid('f1d00000-0000-0000-0000-0000000000f1',
  'f1d00000-0000-0000-0000-0000000000a1')$$, 'FT044', null,
  'nor withdraws a bid');
select is((select row(p.round, p.done, p.finished, p.members)::text from pg_temp.progress(1) p),
  '(1,t,1,2)', 'one sees round 1 finished by them, 1 of 2');
select is((select row(p.round, p.done, p.finished, p.members)::text from pg_temp.progress(2) p),
  '(1,f,1,2)', 'two sees 1 of 2 finished, not them');
select pg_temp.as_player(2);
select is((select count(*)::int from manager_round_done), 1,
  'a participant reads who finished the round');
select pg_temp.as_player(3);
select is((select count(*)::int from manager_round_done), 0, 'an outsider reads nothing');

reset role;
select is((select count(*)::int from manager_rounds
           where league_id = 'f1d00000-0000-0000-0000-0000000000f1'), 0,
  'the round goes on while a participant has not finished it');
set local role authenticated;

-- Two bids and finishes: everyone is done, round 1 closes now.
select lives_ok($$select pg_temp.bid(2, 1, 20)$$, 'two bids 20 on the first athlete');
select lives_ok($$select pg_temp.finish(2)$$, 'two finishes round 1, the last one');

reset role;
select is((select ends_at from manager_rounds
           where league_id = 'f1d00000-0000-0000-0000-0000000000f1' and round = 1),
  now(), 'round 1 closed at once, when the last participant finished it');
select is((select user_id || ':' || amount from manager_awards
           where league_id = 'f1d00000-0000-0000-0000-0000000000f1'
             and athlete_id = 'f1d00000-0000-0000-0000-0000000000a1'),
  'f1d00000-0000-0000-0000-000000000001:30', 'the best bid of the round won, as at its end');
select is((select count(*)::int from manager_round_bids
           where league_id = 'f1d00000-0000-0000-0000-0000000000f1' and round = 1), 2,
  'every bid of the round is kept for its reveal');
select is((select row(o.round, o.ends_at)::text
           from private.manager_open_round('f1d00000-0000-0000-0000-0000000000f1') o),
  row(2, now() + interval '24 hours')::text,
  'round 2 opens now, for its planned 24 hours');
select is(private.close_manager_rounds(), 0, 'the job has nothing to close');
set local role authenticated;

select is((select row(p.round, p.done, p.finished)::text from pg_temp.progress(1) p),
  '(2,f,0)', 'round 2 starts with nobody finished');
select lives_ok($$select pg_temp.bid(1, 2, 20)$$, 'one bids again in round 2');

-- Round 2, then round 3, the last planned one: the mercato ends.
select lives_ok($$select pg_temp.finish(2)$$, 'two finishes round 2');
select lives_ok($$select pg_temp.finish(1)$$, 'one finishes round 2');
reset role;
select is((select string_agg(round::text, ',' order by round) from manager_rounds
           where league_id = 'f1d00000-0000-0000-0000-0000000000f1'), '1,2',
  'round 2 closed early as well');
select is((select ends_at from private.manager_open_round('f1d00000-0000-0000-0000-0000000000f1')),
  now() + interval '24 hours', 'round 3 lasts 24 hours from there');
select is((select mercato_closed_at from manager_leagues
           where id = 'f1d00000-0000-0000-0000-0000000000f1'), null,
  'the mercato is still open for round 3');
set local role authenticated;
select lives_ok($$select pg_temp.finish(1)$$, 'one finishes round 3');
select lives_ok($$select pg_temp.finish(2)$$, 'two finishes round 3, the last planned one');
reset role;
select is((select mercato_closed_at from manager_leagues
           where id = 'f1d00000-0000-0000-0000-0000000000f1'), now(),
  'the mercato ends once everyone finished the last planned round');
set local role authenticated;
select pg_temp.as_player(1);
select throws_ok($$select finish_manager_round('f1d00000-0000-0000-0000-0000000000f1')$$,
  'FT016', null, 'no round to finish once the mercato is closed');
reset role;

select lives_ok($$select * from private.manager_reminder_due()$$,
  'the Manager reminders still read, without the players who finished the round');

select * from finish();
rollback;
