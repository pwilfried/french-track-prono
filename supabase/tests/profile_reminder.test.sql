-- pgTAP: « Plus tard » on the « Complète ton profil » card is remembered per player (#540).
begin;
select plan(4);

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000541', 'fanny@example.test'),
  ('cccccccc-0000-0000-0000-000000000542', 'gus@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('cccccccc-0000-0000-0000-000000000541', 'Fanny', now()),
  ('cccccccc-0000-0000-0000-000000000542', 'Gus', now());

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000541","role":"authenticated"}', true);

select lives_ok(
  $$insert into player_details (profile_id, reminder_hidden_until)
    values ('cccccccc-0000-0000-0000-000000000541', '2026-12-12T08:00:00Z')$$,
  'a player hides the card without any other detail');
select is((select disciplines from player_details), '{}'::text[], 'no discipline is added');

-- Gus neither reads nor changes Fanny's date.
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000542","role":"authenticated"}', true);
select is((select count(*)::int from player_details), 0, 'the date is private');
update player_details set reminder_hidden_until = null
  where profile_id = 'cccccccc-0000-0000-0000-000000000541';
reset role;
select is((select reminder_hidden_until from player_details
  where profile_id = 'cccccccc-0000-0000-0000-000000000541'), '2026-12-12T08:00:00Z'::timestamptz,
  'another player cannot clear it');

select * from finish();
rollback;
