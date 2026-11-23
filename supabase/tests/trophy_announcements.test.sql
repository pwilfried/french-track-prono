-- pgTAP: the trophies announced (#1134). The daily draw, with the service_role key, counts as an
-- admin; a draw keeps the row of a trophy kept, publishes a `trophy` moment in the feed of the
-- predictions or Manager league (read by its members only, the pseudos of the podium given by the
-- feed) and a news notified to the winner once; drawing again announces nothing new.
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(20);

insert into auth.users (id, email) values
  ('7b0f0000-0000-0000-0000-000000000001', 'ana-announce@example.test'),
  ('7b0f0000-0000-0000-0000-000000000002', 'bob-announce@example.test'),
  ('7b0f0000-0000-0000-0000-000000000003', 'cyd-announce@example.test'),
  ('7b0f0000-0000-0000-0000-000000000004', 'max-announce@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('7b0f0000-0000-0000-0000-000000000001', 'Ana Annonce', now()),
  ('7b0f0000-0000-0000-0000-000000000002', 'Bob Annonce', now()),
  ('7b0f0000-0000-0000-0000-000000000003', 'Cyd Annonce', now()),
  ('7b0f0000-0000-0000-0000-000000000004', 'Max Annonce', now());
insert into leagues (id, name, owner_id) values
  ('7b0f1000-0000-0000-0000-000000000001', 'Ligue Annonce', '7b0f0000-0000-0000-0000-000000000001');
insert into league_members (league_id, user_id, role) values
  ('7b0f1000-0000-0000-0000-000000000001', '7b0f0000-0000-0000-0000-000000000001', 'owner'),
  ('7b0f1000-0000-0000-0000-000000000001', '7b0f0000-0000-0000-0000-000000000002', 'member'),
  ('7b0f1000-0000-0000-0000-000000000001', '7b0f0000-0000-0000-0000-000000000003', 'member');
insert into manager_leagues (id, name, owner_id, rules) values
  ('7b0f2000-0000-0000-0000-000000000001', 'Manager Annonce',
   '7b0f0000-0000-0000-0000-000000000001', '{"budget": 100}');
-- Ana and Max have a device; Max turned the « Ma ligue » family off.
insert into push_subscriptions (endpoint, user_id, p256dh, auth) values
  ('https://push.example.test/announce-ana', '7b0f0000-0000-0000-0000-000000000001', 'k', 'a'),
  ('https://push.example.test/announce-max', '7b0f0000-0000-0000-0000-000000000004', 'k', 'a');
insert into reminder_settings (user_id, league) values ('7b0f0000-0000-0000-0000-000000000004', false);

-- The draw of the daily job: the service_role key, no player.
set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);

select ok(is_admin(), 'the service_role key counts as an admin');

create temporary table draw as select $$[
  {"user_id": "7b0f0000-0000-0000-0000-000000000001", "kind": "league", "metal": "gold",
   "league_id": "7b0f1000-0000-0000-0000-000000000001", "league_name": "Ligue Annonce",
   "animal": "guepard"},
  {"user_id": "7b0f0000-0000-0000-0000-000000000002", "kind": "league", "metal": "silver",
   "league_id": "7b0f1000-0000-0000-0000-000000000001", "league_name": "Ligue Annonce",
   "animal": "guepard"},
  {"user_id": "7b0f0000-0000-0000-0000-000000000003", "kind": "league", "metal": "bronze",
   "league_id": "7b0f1000-0000-0000-0000-000000000001", "league_name": "Ligue Annonce",
   "animal": "guepard"},
  {"user_id": "7b0f0000-0000-0000-0000-000000000001", "kind": "manager", "metal": "gold",
   "league_id": "7b0f2000-0000-0000-0000-000000000001", "league_name": "Manager Annonce",
   "animal": "lievre"},
  {"user_id": "7b0f0000-0000-0000-0000-000000000004", "kind": "witness"}
]$$::jsonb as trophies, $$[
  {"feed": "league", "league_id": "7b0f1000-0000-0000-0000-000000000001",
   "key": "trophy:2032:league:7b0f1000-0000-0000-0000-000000000001",
   "user_id": "7b0f0000-0000-0000-0000-000000000001",
   "data": {"trophy": "league", "season": 2032, "animal": "guepard", "podium": [
     {"user_id": "7b0f0000-0000-0000-0000-000000000001", "metal": "gold"},
     {"user_id": "7b0f0000-0000-0000-0000-000000000002", "metal": "silver"},
     {"user_id": "7b0f0000-0000-0000-0000-000000000003", "metal": "bronze"}]}},
  {"feed": "manager", "league_id": "7b0f2000-0000-0000-0000-000000000001",
   "key": "trophy:2032:manager:7b0f2000-0000-0000-0000-000000000001",
   "user_id": "7b0f0000-0000-0000-0000-000000000001",
   "data": {"trophy": "manager", "season": 2032, "animal": "lievre", "podium": [
     {"user_id": "7b0f0000-0000-0000-0000-000000000001", "metal": "gold"}]}}
]$$::jsonb as moments;

select lives_ok($$select admin_replace_trophies(2032, (select trophies from draw),
                                                (select moments from draw),
                                                (select trophies from draw))$$,
  'the daily draw awards the trophies and publishes the announcements');
select is((select count(*) from admin_season_trophies(2032)), 5::bigint,
  'the daily draw reads every trophy of the season');
create temporary table first_rows as select id, kind, user_id from trophies where season = 2032;

select lives_ok($$select admin_replace_trophies(2032, (select trophies from draw),
                                                (select moments from draw),
                                                (select trophies from draw))$$,
  'the daily draw runs again');

reset role;
select is((select count(*) from trophies where season = 2032), 5::bigint,
  'drawing again adds no trophy');
select is((select count(*) from trophies t join first_rows f using (id)), 5::bigint,
  'a trophy kept keeps its row');
select is((select count(*) from league_moments
           where league_id = '7b0f1000-0000-0000-0000-000000000001' and kind = 'trophy'), 1::bigint,
  'the final podium is one moment in the feed of its league, published once');
select is((select count(*) from manager_moments
           where league_id = '7b0f2000-0000-0000-0000-000000000001' and kind = 'trophy'), 1::bigint,
  'the Manager podium is one moment in the feed of its Manager league');
select is((select count(*) from trophy_news where season = 2032), 5::bigint,
  'each fresh trophy is a news, kept once');

-- Bob now wins the gold, Ana the silver, Cyd loses her bronze: the rows follow.
select admin_replace_trophies(2032, $$[
  {"user_id": "7b0f0000-0000-0000-0000-000000000001", "kind": "manager", "metal": "gold",
   "league_id": "7b0f2000-0000-0000-0000-000000000001", "league_name": "Manager Annonce",
   "animal": "lievre"},
  {"user_id": "7b0f0000-0000-0000-0000-000000000004", "kind": "witness"},
  {"user_id": "7b0f0000-0000-0000-0000-000000000001", "kind": "league", "metal": "silver",
   "league_id": "7b0f1000-0000-0000-0000-000000000001", "league_name": "Ligue Annonce",
   "animal": "guepard"},
  {"user_id": "7b0f0000-0000-0000-0000-000000000002", "kind": "league", "metal": "gold",
   "league_id": "7b0f1000-0000-0000-0000-000000000001", "league_name": "Ligue Annonce",
   "animal": "guepard"}
]$$::jsonb);
select results_eq(
  $$select user_id::text || ' ' || metal from trophies where season = 2032 and kind = 'league'
    order by 1$$,
  $$values ('7b0f0000-0000-0000-0000-000000000001 silver'),
           ('7b0f0000-0000-0000-0000-000000000002 gold')$$,
  'a draw changes the metal of a trophy kept and deletes the ones it no longer gives');
select is((select count(*) from trophies t join first_rows f using (id) where t.season = 2032),
  4::bigint, 'a trophy in a new metal keeps its row too');

-- Members read the moment, with the pseudos of the podium; an outsider reads nothing.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "7b0f0000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select is(
  (select data -> 'podium' from league_feed('7b0f1000-0000-0000-0000-000000000001')
   where kind = 'trophy'),
  '[{"pseudo": "Ana Annonce", "metal": "gold"}, {"pseudo": "Bob Annonce", "metal": "silver"},
    {"pseudo": "Cyd Annonce", "metal": "bronze"}]'::jsonb,
  'the feed of the league tells the podium with the pseudos');
select ok(not is_admin(), 'a player is no admin');
select throws_ok($$select * from admin_season_trophies(2032)$$, '42501', null,
  'a player cannot read every trophy of a season');
select throws_ok($$select * from trophy_news$$, '42501', null, 'a player cannot read the news');
select set_config('request.jwt.claims',
  '{"sub": "7b0f0000-0000-0000-0000-000000000004", "role": "authenticated"}', true);
select is((select count(*) from league_moments where kind = 'trophy'
           and league_id = '7b0f1000-0000-0000-0000-000000000001'), 0::bigint,
  'someone outside the league does not read its trophy moments');
reset role;

-- The notifications, at 13:00 in Paris, the news of the morning.
update trophy_news set created_at = '2032-07-13 08:00+00' where season = 2032;
select results_eq(
  $$select user_id::text || ' ' || (payload ->> 'trophy') || ' ' || coalesce(payload ->> 'metal', '-')
    from private.trophy_due('2032-07-13 11:00+00') order by 1$$,
  $$values ('7b0f0000-0000-0000-0000-000000000001 manager gold')$$,
  'the winner of a trophy still held is notified, not one who lost it nor the family off');
select ok(exists (select 1 from private.reminder_due('2032-07-13 11:00+00') where kind = 'trophy'),
  'the trophy notifications are among the reminders due');
select private.reminder_mark_sent((
  select jsonb_agg(jsonb_build_object('user_id', user_id, 'kind', kind, 'evening', evening,
                                      'ref', ref))
  from private.trophy_due('2032-07-13 11:00+00')));
select is((select count(*) from private.trophy_due('2032-07-13 12:00+00')), 0::bigint,
  'a trophy is notified once');
select is((select count(*) from private.trophy_due('2032-07-16 11:00+00')), 0::bigint,
  'a news older than 48 hours is not notified any more');

select * from finish();
rollback;
