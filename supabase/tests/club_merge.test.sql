-- pgTAP: the admin merges a duplicate club into the right one (#381).
begin;
select plan(9);

insert into auth.users (id, email) values
  ('cececece-0000-0000-0000-000000000001', 'admin-merge@example.test'),
  ('cececece-0000-0000-0000-000000000002', 'merge-player@example.test');
insert into profiles (id, pseudo, age_confirmed_at, is_admin) values
  ('cececece-0000-0000-0000-000000000001', 'Admin Fusion', now(), true),
  ('cececece-0000-0000-0000-000000000002', 'Gazelle Zmerge', now(), false);
insert into clubs (id, name, city, department, source, validated) values
  ('cececece-1111-0000-0000-000000000001', 'AC Zmerge', 'Zmerge', '92', 'player', false),
  ('cececece-1111-0000-0000-000000000002', 'Athletic Club de Zmerge', 'Zmerge', '92', 'import', true);
update profiles set club_id = 'cececece-1111-0000-0000-000000000001'
  where id = 'cececece-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cececece-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok(
  $$select admin_merge_club('cececece-1111-0000-0000-000000000001', 'cececece-1111-0000-0000-000000000002')$$,
  '42501', null, 'a player cannot merge clubs');

select set_config('request.jwt.claims',
  '{"sub":"cececece-0000-0000-0000-000000000001","role":"authenticated"}', true);
select isnt((select created_at from admin_list_clubs('zmerge', false, 5000) limit 1), null,
  'the list gives the date of each club');
select throws_ok(
  $$select admin_merge_club('cececece-1111-0000-0000-000000000002', 'cececece-1111-0000-0000-000000000002')$$,
  '22023', null, 'a club cannot be merged into itself');
select throws_ok(
  $$select admin_merge_club('cececece-1111-0000-0000-000000000009', 'cececece-1111-0000-0000-000000000002')$$,
  'P0002', null, 'an unknown club is refused');
select is(
  admin_merge_club('cececece-1111-0000-0000-000000000001', 'cececece-1111-0000-0000-000000000002'),
  1, 'the admin merges the duplicate: one player moved');
reset role;

select is((select club_id from profiles where id = 'cececece-0000-0000-0000-000000000002'),
  'cececece-1111-0000-0000-000000000002'::uuid, 'the player is on the right club');
select is((select count(*)::int from clubs where id = 'cececece-1111-0000-0000-000000000001'), 0,
  'the duplicate is gone');
select results_eq(
  $$select kind, club_name, new_name from club_notices
    where profile_id = 'cececece-0000-0000-0000-000000000002'$$,
  $$values ('merged', 'AC Zmerge', 'Athletic Club de Zmerge')$$,
  'the player gets one « merged » notice, no « removed » one');
select is((select payload->>'action' from admin_actions where payload->>'into_name' = 'Athletic Club de Zmerge'),
  'merge', 'the merge is logged');

select * from finish();
rollback;
