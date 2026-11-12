-- pgTAP: closing the mercato (#424), in the three ways the rules of a league allow. The close is
-- collective: every participant's situation is read, and the bids under way are resolved first.
--   f1 « budgets_spent »: closes by itself once no participant can recruit any more;
--   f2 « last_bidder »: the last participant who can still recruit decides to close it;
--   f3 « scheduled »: closes by itself at the time set for the league.
-- Rolled back at the end.
begin;
select plan(30);

-- Only the athletes of this test are in the catalogue.
update athletes set manager_price = null where manager_price is not null;

insert into auth.users (id, email) values
  ('a4c00000-0000-0000-0000-000000000001', 'one@example.test'),
  ('a4c00000-0000-0000-0000-000000000002', 'two@example.test'),
  ('a4c00000-0000-0000-0000-000000000003', 'three@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('a4c00000-0000-0000-0000-000000000001', 'Clos Une', now()),
  ('a4c00000-0000-0000-0000-000000000002', 'Clos Deux', now()),
  ('a4c00000-0000-0000-0000-000000000003', 'Clos Trois', now());
insert into athletes (id, slug, name, country_code, gender, manager_price) values
  ('a4c00000-0000-0000-0000-0000000000a1', 'clos-une', 'Clos Athlete Une', 'FRA', 'F', 10),
  ('a4c00000-0000-0000-0000-0000000000a2', 'clos-deux', 'Clos Athlete Deux', 'FRA', 'M', 20),
  ('a4c00000-0000-0000-0000-0000000000a3', 'clos-trois', 'Clos Athlete Trois', 'FRA', 'F', 30),
  ('a4c00000-0000-0000-0000-0000000000a4', 'clos-quatre', 'Clos Athlete Quatre', 'FRA', 'M', 10);
insert into athlete_disciplines (athlete_id, discipline, is_primary) values
  ('a4c00000-0000-0000-0000-0000000000a1', '100 m', true),
  ('a4c00000-0000-0000-0000-0000000000a2', '100 m', true),
  ('a4c00000-0000-0000-0000-0000000000a3', '100 m', true),
  ('a4c00000-0000-0000-0000-0000000000a4', '100 m', true);

create function pg_temp.league(p_n int) returns uuid language sql immutable as $$
  select ('a4c00000-0000-0000-0000-0000000000f' || p_n)::uuid
$$;
grant execute on function pg_temp.league(int) to authenticated;
insert into manager_leagues (id, name, owner_id, rules, mercato_opened_at) values
  (pg_temp.league(1), 'Budgets', 'a4c00000-0000-0000-0000-000000000001',
   '{"budget": 40, "minTeamSize": 12, "rounds": {"firstHours": 48, "longRounds": 2, "nextHours": 24},
     "closeModes": ["budgets_spent"]}', now() - interval '1 hour'),
  (pg_temp.league(2), 'Dernier', 'a4c00000-0000-0000-0000-000000000001',
   '{"budget": 40, "minTeamSize": 12, "rounds": {"firstHours": 48, "longRounds": 2, "nextHours": 24},
     "closeModes": ["last_bidder"]}', now() - interval '1 hour'),
  (pg_temp.league(3), 'Date', 'a4c00000-0000-0000-0000-000000000001',
   '{"budget": 40, "minTeamSize": 12, "rounds": {"firstHours": 48, "longRounds": 2, "nextHours": 24},
     "closeModes": ["scheduled"]}', now() - interval '1 hour');
update manager_leagues set mercato_closes_at = now() + interval '1 hour' where id = pg_temp.league(3);
insert into manager_members (league_id, user_id) values
  (pg_temp.league(1), 'a4c00000-0000-0000-0000-000000000001'),
  (pg_temp.league(1), 'a4c00000-0000-0000-0000-000000000002'),
  (pg_temp.league(1), 'a4c00000-0000-0000-0000-000000000003'),
  (pg_temp.league(2), 'a4c00000-0000-0000-0000-000000000001'),
  (pg_temp.league(2), 'a4c00000-0000-0000-0000-000000000002'),
  (pg_temp.league(3), 'a4c00000-0000-0000-0000-000000000001'),
  (pg_temp.league(3), 'a4c00000-0000-0000-0000-000000000002');

create function pg_temp.as_player(p_n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',
    'a4c00000-0000-0000-0000-00000000000' || p_n, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_player(int) to authenticated;
create function pg_temp.bid(p_league int, p_n int, p_athlete int, p_amount int) returns void
language sql as $$
  select pg_temp.as_player(p_n);
  select place_manager_bid(pg_temp.league(p_league),
    ('a4c00000-0000-0000-0000-0000000000a' || p_athlete)::uuid, p_amount);
$$;
grant execute on function pg_temp.bid(int, int, int, int) to authenticated;
create function pg_temp.close(p_league int, p_n int) returns void language sql as $$
  select pg_temp.as_player(p_n);
  select close_manager_mercato(pg_temp.league(p_league));
$$;
grant execute on function pg_temp.close(int, int) to authenticated;
create function pg_temp.may_close(p_league int, p_n int) returns boolean language sql as $$
  select pg_temp.as_player(p_n);
  select can_close_manager_mercato(pg_temp.league(p_league));
$$;
grant execute on function pg_temp.may_close(int, int) to authenticated;
create function pg_temp.opened_hours_ago(p_league int, p_hours int) returns void language sql as $$
  update manager_leagues set mercato_opened_at = now() - make_interval(hours => p_hours)
  where id = pg_temp.league(p_league);
$$;
create function pg_temp.closed(p_league int) returns boolean language sql as $$
  select mercato_closed_at is not null from manager_leagues where id = pg_temp.league(p_league)
$$;
create function pg_temp.won(p_league int, p_athlete int) returns uuid language sql as $$
  select user_id from manager_awards where league_id = pg_temp.league(p_league)
    and athlete_id = ('a4c00000-0000-0000-0000-0000000000a' || p_athlete)::uuid
$$;

select private.close_manager_rounds();
select ok(not pg_temp.closed(1) and not pg_temp.closed(2) and not pg_temp.closed(3),
  'no mercato closes while everybody can still recruit');

-- 1. Budgets spent. One and two spend everything they can in round 1; three keeps 40 credits.
set local role authenticated;
select lives_ok($$select pg_temp.bid(1, 1, 3, 40)$$, 'one bids their 40 credits');
select lives_ok($$select pg_temp.bid(1, 2, 2, 35)$$, 'two bids 35 of their 40 credits');
reset role;
select pg_temp.opened_hours_ago(1, 49);
select private.close_manager_rounds();
select is(pg_temp.won(1, 3), 'a4c00000-0000-0000-0000-000000000001'::uuid,
  'the bids under way are resolved first');
select ok(not pg_temp.closed(1),
  'the close is collective: three can still recruit, the mercato stays open');
set local role authenticated;
select is(pg_temp.may_close(1, 3), false,
  'three is the last who can recruit, but these rules do not let the last bidder close it');
reset role;

set local role authenticated;
select lives_ok($$select pg_temp.bid(1, 3, 1, 40)$$, 'three bids their 40 credits in round 2');
reset role;
select private.close_manager_rounds();
select ok(not pg_temp.closed(1), 'a pending bid does not spend the budget before its round closes');
select pg_temp.opened_hours_ago(1, 97);
select private.close_manager_rounds();
select is(pg_temp.won(1, 1), 'a4c00000-0000-0000-0000-000000000003'::uuid,
  'round 2 is resolved before the close');
select ok(pg_temp.closed(1), 'nobody can recruit any more: the mercato closes by itself');
set local role authenticated;
select throws_ok($$select pg_temp.bid(1, 2, 4, 5)$$, 'FT016', null, 'a closed mercato takes no bid');
reset role;
select is((select round from private.manager_open_round(pg_temp.league(1))), null,
  'and has no round open any more');

-- 2. The last bidder. One spends their 40 credits in round 1; two still has all of theirs.
set local role authenticated;
select lives_ok($$select pg_temp.bid(2, 1, 3, 40)$$, 'one bids their 40 credits');
select is(pg_temp.may_close(2, 2), false, 'nobody closes while another can still recruit');
select throws_ok($$select pg_temp.close(2, 2)$$, 'FT021', null,
  'two cannot close yet: one can still recruit (their bid is not resolved)');
reset role;
select pg_temp.opened_hours_ago(2, 49);
select private.close_manager_rounds();
select ok(not pg_temp.closed(2), 'the rules of the league do not close it when budgets are spent');
set local role authenticated;
select is(pg_temp.may_close(2, 1), false, 'one, without credits, is not the last bidder');
select throws_ok($$select pg_temp.close(2, 1)$$, 'FT021', null, 'and cannot close the mercato');
select throws_ok($$select pg_temp.close(2, 3)$$, '42501', null, 'nor can someone outside the league');
select is(pg_temp.may_close(2, 2), true, 'two is the last participant who can still recruit');
select lives_ok($$select pg_temp.bid(2, 2, 1, 15)$$, 'two bids on one more athlete');
select lives_ok($$select pg_temp.close(2, 2)$$, 'and decides to close the mercato');
reset role;
select ok(pg_temp.closed(2), 'the mercato is closed');
select is(pg_temp.won(2, 1), 'a4c00000-0000-0000-0000-000000000002'::uuid,
  'the bid under way is resolved before the close');
select is((select count(*)::int from manager_bids where league_id = pg_temp.league(2)), 0,
  'no bid is left');
set local role authenticated;
select throws_ok($$select pg_temp.close(2, 2)$$, 'FT016', null, 'a closed mercato closes once');
reset role;

-- 3. Scheduled. One bids; the time set for the close comes before the end of round 1.
set local role authenticated;
select lives_ok($$select pg_temp.bid(3, 1, 1, 12)$$, 'one bids before the scheduled close');
reset role;
update manager_leagues set mercato_closes_at = now() - interval '1 minute'
where id = pg_temp.league(3);
set local role authenticated;
select throws_ok($$select pg_temp.bid(3, 2, 2, 20)$$, 'FT020', null,
  'once the time is over, bids wait for the close');
reset role;
select private.close_manager_rounds();
select ok(pg_temp.closed(3), 'the mercato closes at the scheduled time, budgets left or not');
select is(pg_temp.won(3, 1), 'a4c00000-0000-0000-0000-000000000001'::uuid,
  'the bids under way are resolved at the close');

select * from finish();
rollback;
