-- pgTAP: the bib (#537). A number from 0 to 999, one of six colours, drawn at random by default,
-- shared freely; the emoji avatar is gone.
begin;
select plan(13);

insert into auth.users (id, email) values
  ('b1b00000-0000-0000-0000-000000000001', 'bib-anna@example.test'),
  ('b1b00000-0000-0000-0000-000000000002', 'bib-bob@example.test');

-- Table shape ---------------------------------------------------------------
select hasnt_column('public', 'profiles', 'avatar_emoji', 'the emoji avatar is gone');
select col_type_is('public', 'profiles', 'bib_number', 'smallint', 'the bib number is a smallint');
select col_not_null('public', 'profiles', 'bib_number', 'every profile has a bib number');
select col_not_null('public', 'profiles', 'bib_color', 'every profile has a bib colour');

-- A profile created without a bib draws one: number 1 to 99, a colour of the list.
insert into profiles (id, pseudo, age_confirmed_at)
values ('b1b00000-0000-0000-0000-000000000001', 'Bib Anna', now());
select ok((select bib_number between 1 and 99 from profiles
           where id = 'b1b00000-0000-0000-0000-000000000001'),
  'a new profile draws a number from 1 to 99');
select ok((select bib_color in ('blue', 'red', 'gold', 'green', 'white', 'night') from profiles
           where id = 'b1b00000-0000-0000-0000-000000000001'),
  'a new profile draws a colour of the list');

-- Signed in as Anna ------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"b1b00000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$update profiles set bib_number = 0, bib_color = 'night'
    where id = 'b1b00000-0000-0000-0000-000000000001'$$,
  'the number 0 is allowed');
select lives_ok(
  $$update profiles set bib_number = 999, bib_color = 'white'
    where id = 'b1b00000-0000-0000-0000-000000000001'$$,
  'the number 999 is allowed');
select throws_ok(
  $$update profiles set bib_number = 1000 where id = 'b1b00000-0000-0000-0000-000000000001'$$,
  '23514', null, 'a number above 999 is refused');
select throws_ok(
  $$update profiles set bib_number = -1 where id = 'b1b00000-0000-0000-0000-000000000001'$$,
  '23514', null, 'a negative number is refused');
select throws_ok(
  $$update profiles set bib_color = 'pink' where id = 'b1b00000-0000-0000-0000-000000000001'$$,
  '23514', null, 'a colour outside the six is refused');

-- Signed in as Bob: the same bib as Anna is fine ---------------------------------
select set_config('request.jwt.claims',
  '{"sub":"b1b00000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok(
  $$insert into profiles (id, pseudo, age_confirmed_at, bib_number, bib_color)
    values ('b1b00000-0000-0000-0000-000000000002', 'Bib Bob', now(), 999, 'white')$$,
  'two players may wear the same bib');

reset role;
select is((select count(*) from profiles where bib_number = 999 and bib_color = 'white'
           and id in ('b1b00000-0000-0000-0000-000000000001', 'b1b00000-0000-0000-0000-000000000002')),
  2::bigint, 'both players keep the same bib');

select * from finish();
rollback;
