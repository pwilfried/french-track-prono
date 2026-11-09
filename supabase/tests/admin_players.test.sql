-- pgTAP: the back-office list of players and the leagues of one player (#382).
begin;
select plan(7);

insert into auth.users (id, email) values
  ('efefefef-0000-0000-0000-000000000001', 'admin-list@example.test'),
  ('efefefef-0000-0000-0000-000000000002', 'early@example.test'),
  ('efefefef-0000-0000-0000-000000000003', 'late@example.test');
insert into profiles (id, pseudo, age_confirmed_at, is_admin) values
  ('efefefef-0000-0000-0000-000000000001', 'Admin Liste', now(), true),
  ('efefefef-0000-0000-0000-000000000002', 'Tôt Zlist', now(), false),
  ('efefefef-0000-0000-0000-000000000003', 'Tard Zlist', now(), false);

-- One league of the first event's competition: Tôt joined before the lock, Tard after it.
insert into leagues (id, name, owner_id) values
  ('efefefef-1111-0000-0000-000000000001', 'Ligue Zlist', 'efefefef-0000-0000-0000-000000000002');
insert into league_competitions (league_id, competition_id)
select 'efefefef-1111-0000-0000-000000000001', competition_id from events order by id limit 1;
insert into league_members (league_id, user_id, role, joined_at)
select 'efefefef-1111-0000-0000-000000000001', 'efefefef-0000-0000-0000-000000000002', 'owner', e.lock_at - interval '1 day'
from (select lock_at from events order by id limit 1) e;
insert into league_members (league_id, user_id, role, joined_at)
select 'efefefef-1111-0000-0000-000000000001', 'efefefef-0000-0000-0000-000000000003', 'member', e.lock_at + interval '1 day'
from (select lock_at from events order by id limit 1) e;
-- Tard scored more, but before joining: it does not count in the league.
insert into score_events (user_id, competition_id, event_id, source, points, reason)
select v.u, e.competition_id, e.id, 'prediction', v.p, 'prediction'
from (values ('efefefef-0000-0000-0000-000000000002'::uuid, 5),
             ('efefefef-0000-0000-0000-000000000003'::uuid, 12)) v(u, p),
     (select id, competition_id from events order by id limit 1) e;
insert into league_reports (league_id, user_id) values
  ('efefefef-1111-0000-0000-000000000001', 'efefefef-0000-0000-0000-000000000003');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"efefefef-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$select * from admin_player_leagues('efefefef-0000-0000-0000-000000000003')$$,
  '42501', null, 'a player cannot read the leagues of another');

select set_config('request.jwt.claims',
  '{"sub":"efefefef-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select points::int from admin_list_players() where pseudo = 'Tard Zlist'), 12,
  'the list gives all the points of a player');
select is((select leagues::int from admin_list_players() where pseudo = 'Tard Zlist'), 1,
  'and their number of leagues');
select is((select reports::int from admin_list_players() where pseudo = 'Tôt Zlist'), 1,
  'and the reports received by the leagues they created');
select results_eq(
  $$select name, member_count::int, rank::int from admin_player_leagues('efefefef-0000-0000-0000-000000000002')$$,
  $$values ('Ligue Zlist', 2, 1)$$,
  'Tôt is first of the league');
select results_eq(
  $$select rank::int from admin_player_leagues('efefefef-0000-0000-0000-000000000003')$$,
  $$values (2)$$,
  'Tard is second: his points came before he joined');
select is((select count(*)::int from admin_player_leagues('efefefef-0000-0000-0000-000000000001')), 0,
  'a player in no league has none');

select * from finish();
rollback;
