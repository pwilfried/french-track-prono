-- pgTAP: one banned-words list for league names and pseudos (#344).
begin;
select plan(7);

select ok(is_banned_name('Le Connard'), 'an insult is banned');
select ok(is_banned_name('SuperConnard'), 'an insult glued in camelCase is banned');
select ok(is_banned_name('Officiel_FFA'), 'an official-looking name is banned');
select ok(not is_banned_name('Conrad'), 'a name that only starts like a banned word is allowed');
select ok(is_banned_league_name('Ligue F F A'), 'league names use the same list');

insert into auth.users (id, email) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'carla@example.test');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}', true);

select throws_ok(
  $$insert into profiles (id, pseudo, age_confirmed_at)
    values ('bbbbbbbb-0000-0000-0000-000000000001', 'SuperConnard', now())$$,
  'FT013', null, 'a banned pseudo is refused');
select lives_ok(
  $$insert into profiles (id, pseudo, age_confirmed_at)
    values ('bbbbbbbb-0000-0000-0000-000000000001', 'Carla', now())$$,
  'an ordinary pseudo is accepted');

select * from finish();
rollback;
