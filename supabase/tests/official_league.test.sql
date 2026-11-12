-- pgTAP: the official public league, « Ligue FrenchTrack » (#553): one only, owned by the admin
-- account, joined by choice with no member limit, renamed or deleted by the admin only.
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(11);

-- No admin account yet: nothing happens.
update profiles set is_admin = false;
select private.create_official_league();
select is((select count(*) from leagues where is_official), 0::bigint,
  'without an admin account, no official league is created');

insert into auth.users (id, email) values
  ('0ff10000-0000-0000-0000-000000000001', 'admin-official@example.test'),
  ('0ff10000-0000-0000-0000-000000000002', 'player-official@example.test');
insert into profiles (id, pseudo, age_confirmed_at, is_admin) values
  ('0ff10000-0000-0000-0000-000000000001', 'Admin officiel', now(), true),
  ('0ff10000-0000-0000-0000-000000000002', 'Joueuse officielle', now(), false);
insert into competitions (slug, name, starts_on, ends_on)
values ('european-championships-2026', 'Championnats d''Europe', '2026-11-23', '2026-11-29')
on conflict (slug) do nothing;

select private.create_official_league();
select private.create_official_league();
select is((select count(*) from leagues where is_official), 1::bigint,
  'creating the official league twice makes one league');
select results_eq(
  $$select l.name, l.is_public, l.owner_id, m.role::text from leagues l
    join league_members m on m.league_id = l.id where l.is_official$$,
  $$values ('Ligue FrenchTrack'::text, true, '0ff10000-0000-0000-0000-000000000001'::uuid, 'owner'::text)$$,
  'the Ligue FrenchTrack is public, owned by the admin, who is its only member');
select results_eq(
  $$select c.slug from leagues l join league_competitions lc on lc.league_id = l.id
    join competitions c on c.id = lc.competition_id where l.is_official$$,
  $$values ('european-championships-2026'::text)$$,
  'the Ligue FrenchTrack counts the European Championships');

select throws_ok(
  $$insert into leagues (name, owner_id, is_public, is_official)
    values ('Autre officielle', '0ff10000-0000-0000-0000-000000000002', true, true)$$,
  '23505', null, 'a second official league is refused');

-- 200 members already: the cap of the public leagues does not apply.
insert into auth.users (id, email)
select gen_random_uuid(), 'crowd-official-' || i || '@example.test' from generate_series(1, 200) i;
insert into profiles (id, pseudo, age_confirmed_at)
select id, 'Foule ' || split_part(split_part(email, '@', 1), '-', 3), now()
from auth.users where email like 'crowd-official-%@example.test';
insert into league_members (league_id, user_id)
select l.id, u.id from leagues l, auth.users u
where l.is_official and u.email like 'crowd-official-%@example.test';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "0ff10000-0000-0000-0000-000000000002", "role": "authenticated"}', true);

select is((select bool_and(is_official) from list_public_leagues()
           where league_id = (select id from leagues where name = 'Ligue FrenchTrack')),
  true, 'the list of public leagues says which one is official');
select lives_ok($$select join_public_league((select league_id from list_public_leagues() where is_official))$$,
  'a player joins the official league beyond 200 members');

-- A member who is not the admin can neither rename nor delete it.
update leagues set name = 'Piratée' where is_official;
delete from leagues where is_official;
select throws_ok(
  $$select admin_rename_league((select id from leagues where is_official), 'Piratée')$$,
  '42501', null, 'a player cannot rename the official league through the back-office');
select throws_ok(
  $$select admin_delete_league((select id from leagues where is_official))$$,
  '42501', null, 'a player cannot delete the official league through the back-office');

reset role;
select is((select name from leagues where is_official), 'Ligue FrenchTrack',
  'the official league keeps its name and exists');
select is((select count(*) from league_members m join leagues l on l.id = m.league_id
           where l.is_official), 202::bigint, 'the official league has 202 members');

select * from finish();
rollback;
