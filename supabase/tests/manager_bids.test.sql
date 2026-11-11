-- pgTAP: the secret bids of the mercato (#422). A participant bids, changes and withdraws bids while
-- the mercato is open, at least the reference price and within the budget; nobody sees the bids of
-- the others, nor how many there are. Rolled back at the end.
begin;
select plan(23);

insert into auth.users (id, email) values
  ('b1d00000-0000-0000-0000-000000000001', 'one@example.test'),
  ('b1d00000-0000-0000-0000-000000000002', 'two@example.test'),
  ('b1d00000-0000-0000-0000-000000000003', 'outsider@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('b1d00000-0000-0000-0000-000000000001', 'Enchere Une', now()),
  ('b1d00000-0000-0000-0000-000000000002', 'Enchere Deux', now()),
  ('b1d00000-0000-0000-0000-000000000003', 'Enchere Dehors', now());
insert into athletes (id, slug, name, country_code, gender, manager_price) values
  ('b1d00000-0000-0000-0000-0000000000a1', 'bid-une', 'Offre Une', 'FRA', 'F', 10),
  ('b1d00000-0000-0000-0000-0000000000a2', 'bid-deux', 'Offre Deux', 'FRA', 'M', 20),
  ('b1d00000-0000-0000-0000-0000000000a3', 'bid-sans-prix', 'Offre Sans Prix', 'FRA', 'M', null);
insert into athlete_disciplines (athlete_id, discipline, is_primary) values
  ('b1d00000-0000-0000-0000-0000000000a1', '100 m', true),
  ('b1d00000-0000-0000-0000-0000000000a2', '100 m', true),
  ('b1d00000-0000-0000-0000-0000000000a3', '100 m', true);
insert into manager_leagues (id, name, owner_id, rules) values
  ('b1d00000-0000-0000-0000-0000000000f1', 'Encheres', 'b1d00000-0000-0000-0000-000000000001',
   '{"budget": 100}');
insert into manager_members (league_id, user_id) values
  ('b1d00000-0000-0000-0000-0000000000f1', 'b1d00000-0000-0000-0000-000000000001'),
  ('b1d00000-0000-0000-0000-0000000000f1', 'b1d00000-0000-0000-0000-000000000002');

create function pg_temp.as_player(p_n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',
    'b1d00000-0000-0000-0000-00000000000' || p_n, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_player(int) to authenticated;

set local role authenticated;
select pg_temp.as_player(1);

-- Before the mercato opens, nobody bids.
select throws_ok($$select place_manager_bid('b1d00000-0000-0000-0000-0000000000f1',
  'b1d00000-0000-0000-0000-0000000000a1', 10)$$, 'FT016', null,
  'nobody bids before the mercato opens');

reset role;
update manager_leagues set mercato_opened_at = now() - interval '1 minute'
where id = 'b1d00000-0000-0000-0000-0000000000f1';
set local role authenticated;
select pg_temp.as_player(1);

-- Bids on several athletes at once, at least the reference price.
select lives_ok($$select place_manager_bid('b1d00000-0000-0000-0000-0000000000f1',
  'b1d00000-0000-0000-0000-0000000000a1', 30)$$, 'a participant bids on an athlete');
select lives_ok($$select place_manager_bid('b1d00000-0000-0000-0000-0000000000f1',
  'b1d00000-0000-0000-0000-0000000000a2', 20)$$, 'and on another one, at its reference price');
select throws_ok($$select place_manager_bid('b1d00000-0000-0000-0000-0000000000f1',
  'b1d00000-0000-0000-0000-0000000000a2', 19)$$, 'FT017', null,
  'a bid below the reference price is refused');
select throws_ok($$select place_manager_bid('b1d00000-0000-0000-0000-0000000000f1',
  'b1d00000-0000-0000-0000-0000000000a3', 50)$$, 'P0002', null,
  'an athlete out of the catalogue takes no bid');

-- The budget: the active bids together reserve 100 at most.
select throws_ok($$select place_manager_bid('b1d00000-0000-0000-0000-0000000000f1',
  'b1d00000-0000-0000-0000-0000000000a2', 71)$$, 'FT018', null,
  'a bid that takes the reserved credits over the budget is refused');
select is((select amount from manager_bids where athlete_id = 'b1d00000-0000-0000-0000-0000000000a2'),
  20, 'and the former bid stays');

-- A change recomputes the reservation and moves the time of the bid; the last bid counts.
reset role;
create temp table t_before as select bid_at from manager_bids
  where athlete_id = 'b1d00000-0000-0000-0000-0000000000a1';
grant select on t_before to authenticated;
set local role authenticated;
select pg_temp.as_player(1);
select lives_ok($$select place_manager_bid('b1d00000-0000-0000-0000-0000000000f1',
  'b1d00000-0000-0000-0000-0000000000a2', 70)$$,
  'a changed bid counts in place of the former one: 30 + 70 fits in 100');
select is((select sum(amount)::int from manager_bids), 100, 'the bids reserve the whole budget');
select lives_ok($$select place_manager_bid('b1d00000-0000-0000-0000-0000000000f1',
  'b1d00000-0000-0000-0000-0000000000a1', 25)$$, 'lowering a bid is allowed');
select ok((select bid_at from manager_bids where athlete_id = 'b1d00000-0000-0000-0000-0000000000a1')
  > (select bid_at from t_before), 'a change moves the time of the bid');
select is((select count(*)::int from manager_bids), 2, 'one bid per athlete: the last one counts');

-- The other participant bids on the same athlete, and sees only their own bid.
select pg_temp.as_player(2);
select lives_ok($$select place_manager_bid('b1d00000-0000-0000-0000-0000000000f1',
  'b1d00000-0000-0000-0000-0000000000a1', 90)$$,
  'another participant bids on the same athlete, from their own budget');
select is((select count(*)::int from manager_bids), 1, 'a participant sees their own bids only');
select is((select amount from manager_bids where athlete_id = 'b1d00000-0000-0000-0000-0000000000a1'),
  90, 'not the bid of the other on the same athlete');
select throws_ok($$update manager_bids set amount = 1$$, '42501', null,
  'nobody changes a bid by hand…');
select throws_ok($$delete from manager_bids$$, '42501', null, '…nor deletes one…');
select throws_ok($$insert into manager_bids (league_id, user_id, athlete_id, amount) values
  ('b1d00000-0000-0000-0000-0000000000f1', 'b1d00000-0000-0000-0000-000000000002',
   'b1d00000-0000-0000-0000-0000000000a2', 1)$$, '42501', null, '…nor writes one');

-- An outsider bids nowhere and sees nothing.
select pg_temp.as_player(3);
select throws_ok($$select place_manager_bid('b1d00000-0000-0000-0000-0000000000f1',
  'b1d00000-0000-0000-0000-0000000000a1', 10)$$, '42501', null, 'an outsider does not bid');
select is((select count(*)::int from manager_bids), 0, 'an outsider sees no bid');

-- Withdrawing frees the credits.
select pg_temp.as_player(1);
select lives_ok($$select withdraw_manager_bid('b1d00000-0000-0000-0000-0000000000f1',
  'b1d00000-0000-0000-0000-0000000000a2')$$, 'a participant withdraws a bid');
select lives_ok($$select place_manager_bid('b1d00000-0000-0000-0000-0000000000f1',
  'b1d00000-0000-0000-0000-0000000000a1', 100)$$, 'its credits are free again');

reset role;
select is((select amount from manager_bids
           where user_id = 'b1d00000-0000-0000-0000-000000000002'), 90,
  'the bid of the second participant is as they left it');

select * from finish();
rollback;
