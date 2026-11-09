-- pgTAP: a player is told when the admin validates, renames or removes their club (#372).
begin;
select plan(7);

insert into auth.users (id, email) values
  ('dededede-0000-0000-0000-000000000001', 'admin-notice@example.test'),
  ('dededede-0000-0000-0000-000000000002', 'jade@example.test'),
  ('dededede-0000-0000-0000-000000000003', 'kim@example.test');
insert into profiles (id, pseudo, age_confirmed_at, is_admin) values
  ('dededede-0000-0000-0000-000000000001', 'Admin Notice', now(), true),
  ('dededede-0000-0000-0000-000000000002', 'Jade', now(), false),
  ('dededede-0000-0000-0000-000000000003', 'Kim', now(), false);
insert into clubs (id, name, source, created_by) values
  ('dededede-1111-0000-0000-000000000001', 'Foulees Jade', 'player', 'dededede-0000-0000-0000-000000000002');
update profiles set club_id = 'dededede-1111-0000-0000-000000000001'
  where id = 'dededede-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"dededede-0000-0000-0000-000000000001","role":"authenticated"}', true);
select admin_validate_club('dededede-1111-0000-0000-000000000001');
select admin_save_club('dededede-1111-0000-0000-000000000001', 'Foulées de Jade', '', '');

select set_config('request.jwt.claims',
  '{"sub":"dededede-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select array_agg(kind order by created_at, kind) from club_notices), array['renamed', 'validated'],
  'the player is told of the validation and the new name');
select is((select new_name from club_notices where kind = 'renamed'), 'Foulées de Jade', 'with the new name');

select set_config('request.jwt.claims',
  '{"sub":"dededede-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is((select count(*)::int from club_notices), 0, 'another player sees nothing');
select lives_ok($$select dismiss_club_notice((select id from club_notices limit 1))$$,
  'closing a notice of someone else does nothing');

select set_config('request.jwt.claims',
  '{"sub":"dededede-0000-0000-0000-000000000002","role":"authenticated"}', true);
select dismiss_club_notice(id) from club_notices where kind = 'validated';
select is((select count(*)::int from club_notices where seen_at is null), 1, 'a closed notice is seen');

select set_config('request.jwt.claims',
  '{"sub":"dededede-0000-0000-0000-000000000001","role":"authenticated"}', true);
select admin_delete_club('dededede-1111-0000-0000-000000000001');
select set_config('request.jwt.claims',
  '{"sub":"dededede-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select club_name from club_notices where kind = 'removed'), 'Foulées de Jade',
  'the player is told the club was removed');
select throws_ok($$insert into club_notices (profile_id, kind, club_name)
  values (auth.uid(), 'validated', 'X')$$, '42501', null, 'a player cannot write a notice');

select * from finish();
rollback;
