-- pgTAP: a player predicts only from a league counting the competition (#311).
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(3);

insert into auth.users (id, email) values
  ('dddd0000-0000-0000-0000-000000000001', 'loner@example.test'),
  ('dddd0000-0000-0000-0000-000000000002', 'member@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('dddd0000-0000-0000-0000-000000000001', 'Solitaire', now()),
  ('dddd0000-0000-0000-0000-000000000002', 'Membre', now());

with c as (
  insert into competitions (slug, name, starts_on, ends_on)
  values ('test-league-to-predict', 'Test ligue', current_date + 30, current_date + 31)
  returning id
), other as (
  insert into competitions (slug, name, starts_on, ends_on)
  values ('test-league-other', 'Test autre', current_date + 40, current_date + 41)
  returning id
), e as (
  insert into events (id, competition_id, slug, discipline, gender, starts_at, lock_at)
  select 'dddddddd-0000-0000-0000-00000000000e', id, 'test-ltp-100m', '100 m', 'F',
         now() + interval '30 days', now() + interval '30 days'
  from c
  returning id
)
insert into entries (event_id, athlete_id)
select e.id, a.id from e, (select id from athletes order by id limit 3) a;

-- The member's league counts the competition; the loner's league counts another one.
insert into leagues (id, name, owner_id) values
  ('dddddddd-0000-0000-0000-0000000000a1', 'Bonne ligue', 'dddd0000-0000-0000-0000-000000000002'),
  ('dddddddd-0000-0000-0000-0000000000a2', 'Autre ligue', 'dddd0000-0000-0000-0000-000000000001');
insert into league_members (league_id, user_id, role) values
  ('dddddddd-0000-0000-0000-0000000000a1', 'dddd0000-0000-0000-0000-000000000002', 'owner'),
  ('dddddddd-0000-0000-0000-0000000000a2', 'dddd0000-0000-0000-0000-000000000001', 'owner');
insert into league_competitions (league_id, competition_id)
select 'dddddddd-0000-0000-0000-0000000000a1', id from competitions where slug = 'test-league-to-predict'
union all
select 'dddddddd-0000-0000-0000-0000000000a2', id from competitions where slug = 'test-league-other';

create function test_pick(p_n int) returns uuid language sql stable as $$
  select athlete_id from entries where event_id = 'dddddddd-0000-0000-0000-00000000000e'
  order by athlete_id offset p_n - 1 limit 1
$$;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"dddd0000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok(
  $$insert into predictions (user_id, event_id, p1, p2, p3)
    values ('dddd0000-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-00000000000e',
            test_pick(1), test_pick(2), test_pick(3))$$,
  'FT011', null, 'a player in no league of the competition cannot predict');

select set_config('request.jwt.claims',
  '{"sub":"dddd0000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok(
  $$insert into predictions (user_id, event_id, p1, p2, p3)
    values ('dddd0000-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-00000000000e',
            test_pick(1), test_pick(2), test_pick(3))$$,
  'a member of a league counting the competition predicts');

-- Once his league counts the competition too, the loner may predict.
reset role;
insert into league_competitions (league_id, competition_id)
select 'dddddddd-0000-0000-0000-0000000000a2', id from competitions where slug = 'test-league-to-predict';
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"dddd0000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok(
  $$insert into predictions (user_id, event_id, p1, p2, p3)
    values ('dddd0000-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-00000000000e',
            test_pick(1), test_pick(2), test_pick(3))$$,
  'adding the competition to his league lets him predict');

select * from finish();
rollback;
