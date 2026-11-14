-- pgTAP: the badge levels (#821). Old badges are bronze, a level only goes up, and each player
-- only raises their own.
begin;
select plan(12);

select is(
  (select array_agg(code order by code) from badges),
  array['bleus', 'bond', 'chasseur', 'envol', 'fidele', 'flair', 'force', 'foudre', 'haies',
        'nostradamus', 'serie', 'touche', 'train'],
  'the badges are the 13 of the app, without the codes they replaced');

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000821', 'lea@example.test'),
  ('cccccccc-0000-0000-0000-000000000822', 'max@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('cccccccc-0000-0000-0000-000000000821', 'Lea', now()),
  ('cccccccc-0000-0000-0000-000000000822', 'Max', now());

-- A badge stored before the levels, as the init migration did.
insert into user_badges (user_id, badge_code)
  values ('cccccccc-0000-0000-0000-000000000821', 'nostradamus');
select is((select level from user_badges where badge_code = 'nostradamus'), 'bronze',
  'a badge won before the levels is bronze');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000821","role":"authenticated"}', true);

select lives_ok(
  $$select raise_my_badge_levels(
      '[{"badge":"chasseur","level":"silver"},{"badge":"nostradamus","level":"gold"}]')$$,
  'a player raises their levels');
select is(
  (select array_agg(badge_code || ':' || level order by badge_code) from user_badges
   where user_id = 'cccccccc-0000-0000-0000-000000000821'),
  array['chasseur:silver', 'nostradamus:gold'], 'the new levels are stored');

select raise_my_badge_levels('[{"badge":"chasseur","level":"bronze"}]');
select is((select level from user_badges where badge_code = 'chasseur'), 'silver',
  'a lower level never replaces a higher one');

select throws_ok(
  $$select raise_my_badge_levels('[{"badge":"chasseur","level":"platinum"}]')$$,
  '23514', null, 'a level outside bronze, silver and gold is refused');
select throws_ok(
  $$select raise_my_badge_levels('[{"badge":"inconnu","level":"gold"}]')$$,
  '23503', null, 'an unknown badge is refused');

-- No one writes the table directly, so no one lowers or removes a level.
select throws_ok(
  $$delete from user_badges where user_id = 'cccccccc-0000-0000-0000-000000000821'$$,
  '42501', null, 'a player cannot remove a badge');
select throws_ok(
  $$update user_badges set level = 'bronze'$$, '42501', null, 'a player cannot lower a level');
select is(
  (select array_agg(badge_code || ':' || level order by badge_code) from user_badges
   where user_id = 'cccccccc-0000-0000-0000-000000000821'),
  array['chasseur:silver', 'nostradamus:gold'], 'a level is never lowered nor removed');

-- Max raises only his own: Léa's stay as they are, and he reads them like the rest of a profile.
select set_config('request.jwt.claims',
  '{"sub":"cccccccc-0000-0000-0000-000000000822","role":"authenticated"}', true);
select raise_my_badge_levels('[{"badge":"foudre","level":"bronze"}]');
select is(
  (select count(*)::int from user_badges where user_id = 'cccccccc-0000-0000-0000-000000000822'),
  1, 'another player only raises their own levels');

reset role;
set local role anon;
select throws_ok(
  $$select raise_my_badge_levels('[{"badge":"foudre","level":"gold"}]')$$,
  '42501', null, 'a visitor raises nothing');

select * from finish();
rollback;
