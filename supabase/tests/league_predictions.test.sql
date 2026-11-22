-- pgTAP: the leagues a prediction counts in (#1068). Only the player adds or removes their own
-- prediction, only before the lock, only in a league of theirs that counts the competition.
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(14);

insert into auth.users (id, email) values
  ('eeee1068-0000-0000-0000-000000000001', 'anna@example.test'),
  ('eeee1068-0000-0000-0000-000000000002', 'bob@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('eeee1068-0000-0000-0000-000000000001', 'Anna', now()),
  ('eeee1068-0000-0000-0000-000000000002', 'Bob', now());

-- An open event of the seed competition, and Anna's and Bob's predictions on it.
insert into events (id, competition_id, slug, discipline, gender, starts_at, lock_at)
select 'eeee1068-0000-0000-0000-0000000000e1', c.id, 'test-league-predictions', '100 m', 'F',
       now() + interval '1 day', now() + interval '1 hour'
from competitions c where c.slug = 'ultimate-championship-2026';
insert into entries (event_id, athlete_id)
select 'eeee1068-0000-0000-0000-0000000000e1', athlete_id from entries
where event_id = (select id from events where slug = 'f-100m');
insert into predictions (user_id, event_id, p1, p2, p3)
select u, 'eeee1068-0000-0000-0000-0000000000e1', a[1], a[2], a[3]
from (select array_agg(athlete_id order by athlete_id) a from entries
      where event_id = 'eeee1068-0000-0000-0000-0000000000e1') x,
     unnest(array['eeee1068-0000-0000-0000-000000000001',
                  'eeee1068-0000-0000-0000-000000000002']::uuid[]) u;

-- Two leagues of Anna and Bob counting the competition, one of Anna's counting nothing.
insert into leagues (id, name, owner_id) values
  ('eeee1068-0000-0000-0000-0000000000a1', 'Amis', 'eeee1068-0000-0000-0000-000000000001'),
  ('eeee1068-0000-0000-0000-0000000000a2', 'Club', 'eeee1068-0000-0000-0000-000000000001'),
  ('eeee1068-0000-0000-0000-0000000000a3', 'Vide', 'eeee1068-0000-0000-0000-000000000001');
insert into league_members (league_id, user_id)
select l, u
from unnest(array['eeee1068-0000-0000-0000-0000000000a1',
                  'eeee1068-0000-0000-0000-0000000000a2']::uuid[]) l,
     unnest(array['eeee1068-0000-0000-0000-000000000001',
                  'eeee1068-0000-0000-0000-000000000002']::uuid[]) u;
insert into league_members (league_id, user_id)
values ('eeee1068-0000-0000-0000-0000000000a3', 'eeee1068-0000-0000-0000-000000000001');
insert into league_competitions (league_id, competition_id)
select l, c.id
from competitions c,
     unnest(array['eeee1068-0000-0000-0000-0000000000a1',
                  'eeee1068-0000-0000-0000-0000000000a2']::uuid[]) l
where c.slug = 'ultimate-championship-2026';

create function act_as(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

set local role authenticated;
select act_as('eeee1068-0000-0000-0000-000000000001');

select is((select count(*)::int from league_predictions), 0,
          'a new prediction counts in no league');

select lives_ok(
  $$select set_prediction_leagues('eeee1068-0000-0000-0000-0000000000e1',
                                  array['eeee1068-0000-0000-0000-0000000000a1']::uuid[])$$,
  'the player adds their prediction to one of their leagues');
select is((select array_agg(league_id::text) from league_predictions),
          array['eeee1068-0000-0000-0000-0000000000a1'],
          'it counts in that league only');

select throws_ok(
  $$insert into league_predictions (league_id, user_id, event_id)
    values ('eeee1068-0000-0000-0000-0000000000a2', 'eeee1068-0000-0000-0000-000000000002',
            'eeee1068-0000-0000-0000-0000000000e1')$$,
  '42501', null, 'nobody adds someone else''s prediction');

select throws_ok(
  $$select set_prediction_leagues('eeee1068-0000-0000-0000-0000000000e1',
                                  array['eeee1068-0000-0000-0000-0000000000a3']::uuid[])$$,
  '42501', null, 'a league that does not count the competition takes nothing');

select lives_ok(
  $$select set_prediction_leagues('eeee1068-0000-0000-0000-0000000000e1',
                                  array['eeee1068-0000-0000-0000-0000000000a2']::uuid[])$$,
  'the player moves their prediction to the other league');
select is((select array_agg(league_id::text) from league_predictions),
          array['eeee1068-0000-0000-0000-0000000000a2'],
          'the league left out no longer counts it');

-- Bob, a member of the same league, reads what counts in it; he removes nothing of Anna's.
select act_as('eeee1068-0000-0000-0000-000000000002');
select is((select count(*)::int from league_predictions), 1,
          'a member reads the predictions added to the league');
delete from league_predictions where user_id = 'eeee1068-0000-0000-0000-000000000001';
select is((select count(*)::int from league_predictions), 1,
          'nobody removes someone else''s prediction');
select lives_ok(
  $$select set_prediction_leagues('eeee1068-0000-0000-0000-0000000000e1',
                                  array['eeee1068-0000-0000-0000-0000000000a1']::uuid[])$$,
  'Bob adds his own prediction');

-- The event locks: nothing changes any more.
reset role;
update events set lock_at = now() - interval '1 minute', starts_at = now()
where id = 'eeee1068-0000-0000-0000-0000000000e1';
set local role authenticated;
select act_as('eeee1068-0000-0000-0000-000000000001');

select throws_ok(
  $$select set_prediction_leagues('eeee1068-0000-0000-0000-0000000000e1', '{}')$$,
  'FT043', null, 'after the lock, the leagues of a prediction are fixed');
delete from league_predictions where user_id = 'eeee1068-0000-0000-0000-000000000001';
select is((select count(*)::int from league_predictions
           where user_id = 'eeee1068-0000-0000-0000-000000000001'), 1,
          'after the lock, a prediction is not removed from a league');

-- Leaving a league removes what counted in it.
reset role;
delete from league_members where league_id = 'eeee1068-0000-0000-0000-0000000000a2'
  and user_id = 'eeee1068-0000-0000-0000-000000000001';
select is((select count(*)::int from league_predictions
           where user_id = 'eeee1068-0000-0000-0000-000000000001'), 0,
          'leaving a league removes the predictions added to it');

-- Forgetting a prediction removes it from its leagues.
delete from predictions where user_id = 'eeee1068-0000-0000-0000-000000000002';
select is((select count(*)::int from league_predictions
           where user_id = 'eeee1068-0000-0000-0000-000000000002'), 0,
          'a prediction forgotten counts in no league');

select * from finish();
rollback;
