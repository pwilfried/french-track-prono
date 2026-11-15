-- pgTAP: a signed-in player reads only the public columns of the other profiles (#912), their own
-- whole profile through read_profile(), and the admin every profile.
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(10);

insert into auth.users (id, email) values
  ('c0c00000-0000-0000-0000-000000000001', 'anna@example.test'),
  ('c0c00000-0000-0000-0000-000000000002', 'bob@example.test'),
  ('c0c00000-0000-0000-0000-000000000003', 'boss@example.test');
insert into profiles (id, pseudo, age_confirmed_at, is_admin) values
  ('c0c00000-0000-0000-0000-000000000001', 'Anna', now(), false),
  ('c0c00000-0000-0000-0000-000000000002', 'Bob', now(), false),
  ('c0c00000-0000-0000-0000-000000000003', 'Boss', now(), true);

-- Signed in as Anna ------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"c0c00000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$select id, pseudo, bib_number, bib_color, club_id, created_at from profiles$$,
  'a player reads the pseudo, bib, club and sign-up date of the profiles');

select throws_ok(
  $$select is_admin from profiles where id = 'c0c00000-0000-0000-0000-000000000002'$$,
  '42501', null, 'a player cannot read whether another player is an admin');
select throws_ok(
  $$select blocked_at from profiles where id = 'c0c00000-0000-0000-0000-000000000002'$$,
  '42501', null, 'a player cannot read whether another player is blocked');
select throws_ok(
  $$select age_confirmed_at, inactivity_warned_at from profiles
    where id = 'c0c00000-0000-0000-0000-000000000002'$$,
  '42501', null, 'a player cannot read the other internal columns of a profile');
select throws_ok($$select * from profiles$$, '42501', null,
  'a player cannot read whole profiles from the table');

select is(
  (select pseudo from read_profile('c0c00000-0000-0000-0000-000000000001')),
  'Anna', 'a player reads their own whole profile');
select ok(
  (select age_confirmed_at is not null and not is_admin
   from read_profile('c0c00000-0000-0000-0000-000000000001')),
  'their own profile carries its private columns');
select is_empty(
  $$select * from read_profile('c0c00000-0000-0000-0000-000000000002')$$,
  'a player cannot read the whole profile of another player');

-- Signed in as the admin ---------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"c0c00000-0000-0000-0000-000000000003","role":"authenticated"}', true);

select is(
  (select is_admin from read_profile('c0c00000-0000-0000-0000-000000000002')),
  false, 'the admin reads the whole profile of a player');

-- Anonymous visitor ----------------------------------------------------------------
set local role anon;
select throws_ok(
  $$select * from read_profile('c0c00000-0000-0000-0000-000000000001')$$,
  '42501', null, 'a visitor cannot call read_profile');

select * from finish();
rollback;
