-- pgTAP: the announcements and polls of the community block (#673). Only the admin publishes
-- them; a player votes once, and reads the results only after their vote or once the poll is
-- closed. Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(20);

insert into auth.users (id, email) values
  ('f6730000-0000-0000-0000-000000000001', 'voter@example.test'),
  ('f6730000-0000-0000-0000-000000000002', 'other@example.test'),
  ('f6730000-0000-0000-0000-000000000003', 'admin@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('f6730000-0000-0000-0000-000000000001', 'Votant673', now()),
  ('f6730000-0000-0000-0000-000000000002', 'Autre673', now()),
  ('f6730000-0000-0000-0000-000000000003', 'Admin673', now());
update profiles set is_admin = true where id = 'f6730000-0000-0000-0000-000000000003';

create temp table ctx (poll uuid, announcement uuid);
grant all on ctx to authenticated;
insert into ctx default values;

-- A player publishes nothing, neither directly nor through the functions.
select set_config('request.jwt.claims',
  json_build_object('sub', 'f6730000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;
select throws_ok($$ insert into announcements (kind, title) values ('schedule', 'Programme') $$,
  '42501', null, 'a player cannot write an announcement directly');
select throws_ok($$ select admin_publish_announcement('schedule', 'Programme', null, null) $$,
  '42501', null, 'a player cannot publish an announcement');
select throws_ok($$ insert into polls (question, options, closes_at)
                    values ('Qui ?', array['A', 'B'], now() + interval '1 day') $$,
  '42501', null, 'a player cannot write a poll directly');
select throws_ok($$ select admin_create_poll('Qui ?', array['A', 'B'], now() + interval '1 day') $$,
  '42501', null, 'a player cannot create a poll');

-- The admin publishes an announcement and a poll; a poll needs 2 to 4 answers and a later date.
select set_config('request.jwt.claims',
  json_build_object('sub', 'f6730000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
update ctx set announcement = admin_publish_announcement('episode', 'Épisode 42',
  'Les finales de Paris', 'https://example.test/episode-42');
select isnt((select announcement from ctx), null, 'the admin publishes an announcement');
select throws_ok($$ select admin_publish_announcement('episode', 'Épisode 43', null, null) $$,
  '22023', null, 'a new episode comes with where to listen to it');
select throws_ok($$ select admin_create_poll('Qui ?', array['A'], now() + interval '1 day') $$,
  '22023', null, 'a poll has at least 2 answers');
select throws_ok($$ select admin_create_poll('Qui ?', array['A', 'B', 'C', 'D', 'E'],
                                             now() + interval '1 day') $$,
  '22023', null, 'a poll has at most 4 answers');
select throws_ok($$ select admin_create_poll('Qui ?', array['A', 'B'], now() - interval '1 hour') $$,
  '22023', null, 'a poll closes later');
update ctx set poll = admin_create_poll('Qui gagne le 100 m ?', array['Alpha', 'Bravo', 'Charlie'],
  now() + interval '1 day');
select isnt((select poll from ctx), null, 'the admin creates a poll');

-- Before voting, the player reads the question but not the results.
select set_config('request.jwt.claims',
  json_build_object('sub', 'f6730000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
select results_eq(
  $$ select question, my_choice, votes from community_polls() where id = (select poll from ctx) $$,
  $$ values ('Qui gagne le 100 m ?'::text, null::int, null::int[]) $$,
  'before voting, the results are not readable');
select is((select count(*) from announcements), 1::bigint, 'a player reads the announcements');

-- The player votes once, then reads the results.
select lives_ok($$ select vote_poll((select poll from ctx), 1) $$, 'a player votes');
select throws_ok($$ select vote_poll((select poll from ctx), 0) $$,
  '23505', null, 'a player votes only once');
select throws_ok($$ select vote_poll((select poll from ctx), 3) $$,
  '22023', null, 'an answer the poll does not have is refused');
select results_eq(
  $$ select my_choice, votes from community_polls() where id = (select poll from ctx) $$,
  $$ values (1, array[0, 1, 0]) $$,
  'after voting, the player reads the results');
select throws_ok($$ update poll_votes set choice = 0 $$,
  '42501', null, 'a player cannot change their vote');

-- Another player does not read the results before voting, nor others' votes.
select set_config('request.jwt.claims',
  json_build_object('sub', 'f6730000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
select is((select count(*) from poll_votes), 0::bigint, 'a player reads no one else''s vote');

-- Once the poll is closed, nobody votes and everybody reads the results.
reset role;
update polls set closes_at = now() - interval '1 minute' where id = (select poll from ctx);
set local role authenticated;
select throws_ok($$ select vote_poll((select poll from ctx), 0) $$,
  'FT034', null, 'nobody votes once the poll is closed');
select results_eq(
  $$ select my_choice, votes from community_polls() where id = (select poll from ctx) $$,
  $$ values (null::int, array[0, 1, 0]) $$,
  'once the poll is closed, the results are readable without a vote');

select * from finish();
rollback;
