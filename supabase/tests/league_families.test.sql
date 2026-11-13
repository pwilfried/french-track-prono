-- pgTAP: a league limited to event families (#613). Families are chosen at creation, the creator
-- adds more later (counted from that moment), none is ever removed. Run with `supabase test db`.
-- Everything is rolled back at the end.
begin;
select plan(14);

insert into auth.users (id, email) values
  ('f6130000-0000-0000-0000-000000000001', 'owner@example.test'),
  ('f6130000-0000-0000-0000-000000000002', 'member@example.test'),
  ('f6130000-0000-0000-0000-000000000003', 'outsider@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('f6130000-0000-0000-0000-000000000001', 'Chef613', now()),
  ('f6130000-0000-0000-0000-000000000002', 'Membre613', now()),
  ('f6130000-0000-0000-0000-000000000003', 'Dehors613', now());
insert into competitions (slug, name, starts_on, ends_on)
values ('test-families', 'Test familles', current_date + 10, current_date + 11);

create temp table ctx (name text, league uuid, code text);
grant all on ctx to authenticated;

select set_config('request.jwt.claims',
  json_build_object('sub', 'f6130000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into ctx select 'sprint', * from create_league('Sprinteurs', array['test-families'], false,
  array['sprint', 'hurdles', 'sprint']);
insert into ctx select 'all', * from create_league('Tout', array['test-families']);

select is(
  (select array_agg(family || ':' || coalesce(added_at::text, 'creation') order by family)
     from league_families where league_id = (select league from ctx where name = 'sprint')),
  array['hurdles:creation', 'sprint:creation']::text[],
  'the families chosen at creation are kept once each, counted from the start');
select is((select count(*) from league_families where league_id = (select league from ctx where name = 'all')),
  0::bigint, 'a league created without family counts every event');

select throws_ok($$ select create_league('Curling', array['test-families'], false, array['curling']) $$,
  '23514', null, 'an unknown family is refused');
select is((select count(*) from leagues where name = 'Curling'), 0::bigint,
  'a league with an unknown family is not created');

select lives_ok($$ select add_league_family((select league from ctx where name = 'sprint'), 'throws') $$,
  'the creator adds a family');
select is(
  (select added_at from league_families
     where league_id = (select league from ctx where name = 'sprint') and family = 'throws'),
  now(), 'an added family keeps the moment it was added');
select lives_ok($$ select add_league_family((select league from ctx where name = 'sprint'), 'sprint') $$,
  'adding a family the league already has changes nothing');
select is(
  (select added_at from league_families
     where league_id = (select league from ctx where name = 'sprint') and family = 'sprint'),
  null::timestamptz, 'a family chosen at creation stays counted from the start');
select throws_ok($$ select add_league_family((select league from ctx where name = 'all'), 'throws') $$,
  'FT029', null, 'a league on all events gets no family');
select throws_ok($$ select add_league_family((select league from ctx where name = 'sprint'), 'curling') $$,
  '23514', null, 'an unknown family cannot be added');

-- No family is ever removed, and nobody writes the table directly.
select throws_ok($$ delete from league_families where league_id = (select league from ctx where name = 'sprint') $$,
  '42501', null, 'the creator cannot remove a family');

-- A member reads the families, but cannot add one; someone outside reads nothing.
reset role;
insert into league_members (league_id, user_id)
select league, 'f6130000-0000-0000-0000-000000000002' from ctx where name = 'sprint';
select set_config('request.jwt.claims',
  json_build_object('sub', 'f6130000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select count(*) from league_families where league_id = (select league from ctx where name = 'sprint')),
  3::bigint, 'a member reads the families of the league');
select throws_ok($$ select add_league_family((select league from ctx where name = 'sprint'), 'relay') $$,
  '42501', null, 'only the creator adds a family');
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', 'f6130000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select count(*) from league_families where league_id = (select league from ctx where name = 'sprint')),
  0::bigint, 'a player outside the league reads nothing');
reset role;

select * from finish();
rollback;
