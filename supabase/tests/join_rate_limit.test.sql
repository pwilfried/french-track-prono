-- pgTAP: invite codes cannot be guessed in bulk (#155).
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(4);

insert into auth.users (id, email) values ('ffff0000-0000-0000-0000-000000000001', 'guesser@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values ('ffff0000-0000-0000-0000-000000000001', 'Devin', now());
insert into leagues (id, name, owner_id, invite_code) values
  ('ffffffff-0000-0000-0000-0000000000a1', 'Cible', 'ffff0000-0000-0000-0000-000000000001', 'ZZZZ22');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"ffff0000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(join_league('AAAA22'), null, 'a wrong code answers nothing, and is remembered');
select is((select count(*) from generate_series(1, 9) n where join_league('BBBB' || lpad(n::text, 2, '3')) is null),
  9::bigint, 'nine more wrong codes are still answered');
select throws_ok($$ select join_league('CCCC22') $$, 'FT012', null,
  'after ten wrong codes in an hour, joining with a code is refused');
select throws_ok($$ select join_league('ZZZZ22') $$, 'FT012', null,
  'even with the right code, until the hour has passed');

select * from finish();
rollback;
