-- pgTAP: profile rules (age confirmation, unique pseudo, row-level security).
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(11);

-- Two test accounts (fictional addresses).
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'anna@example.test'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'bob@example.test');

-- Table shape ---------------------------------------------------------------
select col_not_null('public', 'profiles', 'age_confirmed_at', 'a profile needs its age confirmation');
select hasnt_column('public', 'profiles', 'email', 'profiles hold no e-mail address');

-- Signed in as Anna --------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$insert into profiles (id, pseudo, age_confirmed_at)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'Anna', now())$$,
  'a signed-in user can create their own profile');

select throws_ok(
  $$insert into profiles (id, pseudo, age_confirmed_at)
    values ('aaaaaaaa-0000-0000-0000-000000000002', 'Imposter', now())$$,
  '42501', null,
  'a user cannot create a profile for someone else');

select throws_ok(
  $$update profiles set id = 'aaaaaaaa-0000-0000-0000-000000000002'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '42501', null,
  'a user cannot hand their profile to someone else');

-- Signed in as Bob ---------------------------------------------------------
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);

select throws_ok(
  $$insert into profiles (id, pseudo) values ('aaaaaaaa-0000-0000-0000-000000000002', 'Bob')$$,
  '23502', null,
  'a profile cannot be created without the age confirmation');

select throws_ok(
  $$insert into profiles (id, pseudo, age_confirmed_at)
    values ('aaaaaaaa-0000-0000-0000-000000000002', 'ANNA', now())$$,
  '23505', null,
  'a pseudo already taken is refused whatever its case');

select lives_ok(
  $$insert into profiles (id, pseudo, age_confirmed_at)
    values ('aaaaaaaa-0000-0000-0000-000000000002', 'Bob', now())$$,
  'a free pseudo is accepted');

select is(
  (with changed as (
     update profiles set pseudo = 'Hacked'
     where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1)
   select count(*) from changed),
  0::bigint,
  'a user cannot change another profile');

select is((select count(*) from profiles), 2::bigint, 'signed-in players can see the profiles');

-- Anonymous visitor ----------------------------------------------------------
set local role anon;
select is((select count(*) from profiles), 0::bigint, 'an anonymous visitor sees no profile');

select * from finish();
rollback;
