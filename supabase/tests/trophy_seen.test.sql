-- pgTAP: the celebration of a new trophy is shown once (#1135). A player marks only their own
-- trophies as seen; a trophy that changes metal is new again. Run with `supabase test db`.
-- Everything is rolled back at the end.
begin;
select plan(8);

insert into auth.users (id, email) values
  ('7c0f0000-0000-0000-0000-000000000001', 'ana-seen@example.test'),
  ('7c0f0000-0000-0000-0000-000000000002', 'bob-seen@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('7c0f0000-0000-0000-0000-000000000001', 'Ana Vue', now()),
  ('7c0f0000-0000-0000-0000-000000000002', 'Bob Vue', now());
insert into trophies (user_id, season, kind, metal, league_name, animal) values
  ('7c0f0000-0000-0000-0000-000000000001', 2031, 'league', 'gold', 'Ligue Vue', 'guepard'),
  ('7c0f0000-0000-0000-0000-000000000002', 2031, 'league', 'silver', 'Ligue Vue', 'guepard');

select is((select count(*)::int from trophies where seen_at is null), 2,
          'a new trophy is not seen yet');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "7c0f0000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select lives_ok($$select mark_my_trophies_seen()$$, 'a player marks their trophies as seen');
select is((select count(*)::int from trophies
           where user_id = '7c0f0000-0000-0000-0000-000000000001' and seen_at is not null), 1,
          'their trophy is seen');
select is((select count(*)::int from trophies
           where user_id = '7c0f0000-0000-0000-0000-000000000002' and seen_at is null), 1,
          'the trophy of another player stays unseen');
select throws_ok($$update trophies set seen_at = null$$, '42501', null,
                 'a player cannot write the trophies directly');

select lives_ok($$select mark_my_trophies_seen()$$, 'marking twice is harmless');

reset role;
update trophies set metal = 'silver'
  where user_id = '7c0f0000-0000-0000-0000-000000000001';
select is((select seen_at from trophies
           where user_id = '7c0f0000-0000-0000-0000-000000000001'), null,
          'a trophy in a new metal is new again');
update trophies set league_name = 'Ligue Renommée'
  where user_id = '7c0f0000-0000-0000-0000-000000000002';
select is((select count(*)::int from trophies
           where user_id = '7c0f0000-0000-0000-0000-000000000002' and seen_at is null), 1,
          'a trophy kept in the same metal keeps its state');

select * from finish();
rollback;
