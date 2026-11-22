-- pgTAP: the reveal of a mercato round (#1093), sent by private.reminder_due() in the « Manager »
-- family to every participant, once per round, also when the round closes early because everyone
-- finished it (#1084).
--   Round 1: player 1 bids on athletes 1 (10) and 2 (5), player 2 on athlete 1 (13), player 3 on
--   athlete 3 (4), player 4 bids nothing. Then everyone finishes the round: it closes at once.
--   Player 4 is in their quiet hours.
-- Rolled back at the end.
begin;
select plan(10);

create function pg_temp.player(p_n int) returns uuid language sql immutable as $$
  select ('c1093100-0000-0000-0000-00000000000' || p_n)::uuid
$$;
create function pg_temp.athlete(p_n int) returns uuid language sql immutable as $$
  select ('c1093100-0000-0000-0000-0000000000a' || p_n)::uuid
$$;

insert into auth.users (id, email)
select pg_temp.player(n), 'reveal-' || n || '@example.test' from generate_series(1, 4) n;
insert into profiles (id, pseudo, age_confirmed_at)
select pg_temp.player(n), 'Révélé ' || n, now() from generate_series(1, 4) n;
insert into push_subscriptions (endpoint, user_id, p256dh, auth)
select 'https://push.example.test/reveal-' || n, pg_temp.player(n), 'key', 'auth'
from generate_series(1, 4) n;
-- No quiet hours (0 to 0), except for player 4: from the current hour in Paris for two hours.
insert into reminder_settings (user_id, quiet_from, quiet_to)
select pg_temp.player(n),
  case when n = 4 then extract(hour from now() at time zone 'Europe/Paris')::int else 0 end,
  case when n = 4 then (extract(hour from now() at time zone 'Europe/Paris')::int + 2) % 24 else 0 end
from generate_series(1, 4) n;

insert into athletes (id, slug, name, country_code, gender, manager_price)
select pg_temp.athlete(n), 'reveal-athlete-' || n, 'Révélée ' || n, 'FRA', 'F', 3
from generate_series(1, 3) n;
insert into athlete_disciplines (athlete_id, discipline, is_primary)
select pg_temp.athlete(n), '100 m', true from generate_series(1, 3) n;

insert into manager_leagues (id, name, owner_id, rules, mercato_opened_at) values
  ('c1093100-0000-0000-0000-0000000000f1', 'Révélations', pg_temp.player(1),
   '{"budget": 100, "rounds": {"firstHours": 48, "longRounds": 1, "nextHours": 24},
     "closeModes": ["last_bidder"]}',
   now() - interval '1 hour');
insert into manager_members (league_id, user_id)
select 'c1093100-0000-0000-0000-0000000000f1', pg_temp.player(n) from generate_series(1, 4) n;
insert into manager_bids (league_id, user_id, athlete_id, amount, bid_at)
select 'c1093100-0000-0000-0000-0000000000f1', pg_temp.player(b.n), pg_temp.athlete(b.a),
  b.amount, now() - interval '30 minutes'
from (values (1, 1, 10), (1, 2, 5), (2, 1, 13), (3, 3, 4)) b(n, a, amount);

create function pg_temp.finish(p_n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.player(p_n),
    'role', 'authenticated')::text, true);
  select finish_manager_round('c1093100-0000-0000-0000-0000000000f1');
$$;
grant execute on function pg_temp.finish(int) to authenticated;
grant execute on function pg_temp.player(int) to authenticated;

create temp view due as
  select d.user_id, d.kind, d.evening, d.ref, d.payload from private.reminder_due() d
  where d.user_id::text like 'c1093100-%' and d.kind = 'mercato_reveal';

select is((select count(*)::int from due), 0, 'nothing while the round is open');

-- Everyone finishes the round: it closes now, 47 hours early.
set local role authenticated;
select pg_temp.finish(n) from generate_series(1, 4) n;
reset role;
select is((select count(*)::int from manager_rounds
           where league_id = 'c1093100-0000-0000-0000-0000000000f1'), 1,
  'the round closed early, once everyone finished it');

select results_eq(
  $$ select user_id, ref, payload ->> 'round', payload ->> 'won', payload ->> 'bids',
            payload ->> 'last'
     from due order by user_id $$,
  $$ values (pg_temp.player(1), 'c1093100-0000-0000-0000-0000000000f1:1', '1', '1', '2', 'false'),
            (pg_temp.player(2), 'c1093100-0000-0000-0000-0000000000f1:1', '1', '1', '1', 'false'),
            (pg_temp.player(3), 'c1093100-0000-0000-0000-0000000000f1:1', '1', '1', '1', 'false') $$,
  'the reveal of the round, to every participant, with how many of their bids they won');
select is((select payload -> 'lost' from due where user_id = pg_temp.player(1)),
  '{"pseudo": "Révélé 2", "athlete": "Révélée 1", "diff": 3}'::jsonb,
  '…and who took the athlete they missed, for how much more');
select is((select payload -> 'lost' from due where user_id = pg_temp.player(2)), 'null'::jsonb,
  'nobody took anything from a player who won every bid');
select is((select count(*)::int from due where user_id = pg_temp.player(4)), 0,
  'nothing during the quiet hours');

-- A reveal already seen in the app, or the « Manager » family off: nothing.
update manager_members set revealed_round = 1
where league_id = 'c1093100-0000-0000-0000-0000000000f1' and user_id = pg_temp.player(3);
update reminder_settings set manager = false where user_id = pg_temp.player(2);
select is((select array_agg(user_id) from due), array[pg_temp.player(1)],
  'nothing for a player who saw the reveal, nor with the « Manager » family off');
update reminder_settings set manager = true where user_id = pg_temp.player(2);

-- Sent: never twice the same round.
select private.reminder_mark_sent((select jsonb_agg(jsonb_build_object(
  'user_id', user_id, 'kind', kind, 'evening', evening, 'ref', ref)) from due));
select is((select count(*)::int from reminder_log
           where user_id::text like 'c1093100-%' and kind = 'mercato_reveal'), 2,
  'what was sent is recorded once');
select is((select count(*)::int from due), 0, 'no reveal is sent twice');
select is((select count(*)::int from private.reminder_due(now() + interval '15 minutes') d
           where d.user_id::text like 'c1093100-%' and d.kind = 'mercato_reveal'),
  0, 'not even a little later, on another run of the cron');

select * from finish();
rollback;
