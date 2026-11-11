-- pgTAP: the admin manages clubs (#366).
begin;
select plan(16);

insert into auth.users (id, email) values
  ('cdcdcdcd-0000-0000-0000-000000000001', 'admin-club@example.test'),
  ('cdcdcdcd-0000-0000-0000-000000000002', 'ines@example.test');
insert into profiles (id, pseudo, age_confirmed_at, is_admin) values
  ('cdcdcdcd-0000-0000-0000-000000000001', 'Admin Club', now(), true),
  ('cdcdcdcd-0000-0000-0000-000000000002', 'Inès', now(), false);
insert into clubs (id, name, city, source, created_by) values
  ('cdcdcdcd-1111-0000-0000-000000000001', 'Foulées Zqmod', 'Nulle-Part', 'player', 'cdcdcdcd-0000-0000-0000-000000000002');
update profiles set club_id = 'cdcdcdcd-1111-0000-0000-000000000001'
  where id = 'cdcdcdcd-0000-0000-0000-000000000002';
select import_clubs('[{"name":"Club Importé Zqmod","city":"Ici","department":"75","siren":"444444444"}]');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cdcdcdcd-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$select * from admin_list_clubs('')$$, '42501', null, 'a player cannot list clubs');
select throws_ok($$select admin_delete_club('cdcdcdcd-1111-0000-0000-000000000001')$$, '42501', null,
  'a player cannot delete a club');

select set_config('request.jwt.claims',
  '{"sub":"cdcdcdcd-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select name from admin_list_clubs('zqmod', true)), 'Foulées Zqmod', 'clubs to validate are listed');
select is((select player_count::int from admin_list_clubs('foulees zqmod')), 1, 'with their players');
select lives_ok($$select admin_validate_club('cdcdcdcd-1111-0000-0000-000000000001')$$, 'the admin validates');
select is((select count(*)::int from search_clubs('zqmod')), 2, 'a validated club is found by players');
-- #479: the words of the query in another order than the name (and the town in between).
select is((select name from search_clubs('zqmod nulle foulees')), 'Foulées Zqmod',
  'players find a club whatever the order of the words');
select is((select name from admin_list_clubs('zqmod nulle foulees')), 'Foulées Zqmod',
  'the admin finds it with the same words');
-- #508: no limit lists every club, past the old cap of 5,000.
reset role;
insert into clubs (name, source, validated)
  select 'Zqmany ' || lpad(i::text, 4, '0'), 'import', true from generate_series(1, 5001) i;
set local role authenticated;
select is((select count(*)::int from admin_list_clubs('zqmany', false, null)), 5001,
  'a null limit lists every club');
select is((select count(*)::int from admin_list_clubs('zqmany')), 50, 'the default limit stays 50');
select isnt(admin_save_club(null, 'Nouveau Club Zqmod', 'Là', '13'), null, 'the admin creates a club');
select throws_ok($$select admin_save_club(null, 'Club Officiel FFA', '', '')$$, 'FT013', null,
  'banned words are refused');
select lives_ok(
  $$select admin_save_club((select id from clubs where siren = '444444444'), 'Club Renommé Zqmod', 'Ici', '75')$$,
  'the admin renames an imported club');
reset role;
select import_clubs('[{"name":"Club Importé Zqmod","city":"Ici","department":"75","siren":"444444444"}]');
select is((select name from clubs where siren = '444444444'), 'Club Renommé Zqmod',
  'the import keeps the name the admin chose');
set local role authenticated;
select lives_ok($$select admin_delete_club('cdcdcdcd-1111-0000-0000-000000000001')$$, 'the admin deletes a club');
reset role;
select is((select club_id from profiles where id = 'cdcdcdcd-0000-0000-0000-000000000002'), null,
  'its players have no club any more');

select * from finish();
rollback;
