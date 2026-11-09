-- pgTAP: the back-office leagues (#383): list, dismiss reports, members, remove a member.
begin;
select plan(11);

insert into auth.users (id, email) values
  ('f1f1f1f1-0000-0000-0000-000000000001', 'admin-leagues@example.test'),
  ('f1f1f1f1-0000-0000-0000-000000000002', 'owner-zl@example.test'),
  ('f1f1f1f1-0000-0000-0000-000000000003', 'member-zl@example.test');
insert into profiles (id, pseudo, age_confirmed_at, is_admin) values
  ('f1f1f1f1-0000-0000-0000-000000000001', 'Admin Ligues', now(), true),
  ('f1f1f1f1-0000-0000-0000-000000000002', 'Patronne Zl', now(), false),
  ('f1f1f1f1-0000-0000-0000-000000000003', 'Membre Zl', now(), false);
insert into leagues (id, name, owner_id, is_public) values
  ('f1f1f1f1-1111-0000-0000-000000000001', 'Publique Zl', 'f1f1f1f1-0000-0000-0000-000000000002', true);
insert into league_competitions (league_id, competition_id)
select 'f1f1f1f1-1111-0000-0000-000000000001', competition_id from events order by id limit 1;
insert into league_members (league_id, user_id, role, joined_at)
select 'f1f1f1f1-1111-0000-0000-000000000001', v.u, v.r::league_role, e.lock_at - interval '1 day'
from (values ('f1f1f1f1-0000-0000-0000-000000000002'::uuid, 'owner'),
             ('f1f1f1f1-0000-0000-0000-000000000003'::uuid, 'member')) v(u, r),
     (select lock_at from events order by id limit 1) e;
insert into score_events (user_id, competition_id, event_id, source, points, reason)
select 'f1f1f1f1-0000-0000-0000-000000000003', e.competition_id, e.id, 'prediction', 7, 'prediction'
from (select id, competition_id from events order by id limit 1) e;
insert into league_reports (league_id, user_id) values
  ('f1f1f1f1-1111-0000-0000-000000000001', 'f1f1f1f1-0000-0000-0000-000000000003');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"f1f1f1f1-0000-0000-0000-000000000003","role":"authenticated"}', true);
select throws_ok($$select * from admin_league_members('f1f1f1f1-1111-0000-0000-000000000001')$$,
  '42501', null, 'a player cannot read the members as admin');
select throws_ok($$select admin_dismiss_league_reports('f1f1f1f1-1111-0000-0000-000000000001')$$,
  '42501', null, 'a player cannot dismiss reports');

select set_config('request.jwt.claims',
  '{"sub":"f1f1f1f1-0000-0000-0000-000000000001","role":"authenticated"}', true);
select results_eq(
  $$select owner, member_count::int, report_count::int, is_public, cardinality(competitions)
    from admin_list_leagues() where name = 'Publique Zl'$$,
  $$values ('Patronne Zl', 2, 1, true, 1)$$,
  'the list gives the owner, members, reports and competitions');
select results_eq(
  $$select pseudo, is_owner, points::int, rank::int
    from admin_league_members('f1f1f1f1-1111-0000-0000-000000000001')$$,
  $$values ('Membre Zl', false, 7, 1), ('Patronne Zl', true, 0, 2)$$,
  'the members come with their points and rank');
select lives_ok($$select admin_dismiss_league_reports('f1f1f1f1-1111-0000-0000-000000000001')$$,
  'the admin dismisses the reports');
select is((select report_count::int from admin_list_leagues() where name = 'Publique Zl'), 0,
  'the reports are gone');
select throws_ok(
  $$select admin_remove_league_member('f1f1f1f1-1111-0000-0000-000000000001', 'f1f1f1f1-0000-0000-0000-000000000002')$$,
  '2BP01', null, 'the owner cannot be removed');
select lives_ok(
  $$select admin_remove_league_member('f1f1f1f1-1111-0000-0000-000000000001', 'f1f1f1f1-0000-0000-0000-000000000003')$$,
  'the admin removes a member');
select throws_ok(
  $$select admin_remove_league_member('f1f1f1f1-1111-0000-0000-000000000001', 'f1f1f1f1-0000-0000-0000-000000000003')$$,
  'P0002', null, 'a member already gone is unknown');
reset role;
select is((select count(*)::int from league_members where league_id = 'f1f1f1f1-1111-0000-0000-000000000001'), 1,
  'one member is left');
select is((select payload->>'action' from admin_actions
           where payload->>'pseudo' = 'Membre Zl' order by at desc limit 1),
  'remove_member', 'the removal is logged');

select * from finish();
rollback;
