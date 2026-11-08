-- pgTAP: « autre athlète » (#260). With odds, a player picks among the proposed athletes and may
-- put « autre athlète » (null) on one place; without odds, three athletes. Rolled back at the end.
begin;
select plan(5);

insert into auth.users (id, email) values ('cbcbcbcb-0000-0000-0000-000000000001', 'player@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values ('cbcbcbcb-0000-0000-0000-000000000001', 'Joueur', now());

-- Two open events of 7 athletes: one in a competition with odds, one without.
create temp table fixture as
with c as (
  insert into competitions (slug, name, starts_on, ends_on, odds_enabled)
  values ('other-odds', 'Other odds', current_date + 2, current_date + 3, true),
         ('other-plain', 'Other plain', current_date + 2, current_date + 3, false)
  returning id, odds_enabled
), e as (
  insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
  select id, case when odds_enabled then 'other-odds-100m' else 'other-plain-100m' end, '100 m', 'F',
         now() + interval '2 days', now() + interval '2 days' from c
  returning id, slug
)
select (select id from e where slug = 'other-odds-100m') as odds_event,
       (select id from e where slug = 'other-plain-100m') as plain_event,
       array(select id from athletes order by id limit 7) as athletes;
insert into entries (event_id, athlete_id)
select ev, unnest(athletes) from fixture, unnest(array[odds_event, plain_event]) ev;
-- Five athletes proposed, and « autre athlète ».
insert into event_odds (event_id, athlete_id, odds)
select odds_event, athletes[i], 1 + i from fixture, generate_series(1, 5) i
union all select odds_event, null, 9 from fixture;
grant select on fixture to authenticated;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cbcbcbcb-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok($$insert into predictions (user_id, event_id, p1, p2, p3)
  select 'cbcbcbcb-0000-0000-0000-000000000001', odds_event, athletes[1], null, athletes[2] from fixture$$,
  'with odds, « autre athlète » can take one place');
select throws_ok($$update predictions set p1 = null
  where event_id = (select odds_event from fixture)$$, '23514', null,
  '« autre athlète » cannot take two places');
select throws_ok($$update predictions set p3 = (select athletes[6] from fixture)
  where event_id = (select odds_event from fixture)$$, 'FT006', null,
  'an athlete that is not proposed is refused');
select throws_ok($$insert into predictions (user_id, event_id, p1, p2, p3)
  select 'cbcbcbcb-0000-0000-0000-000000000001', plain_event, athletes[1], null, athletes[2] from fixture$$,
  'FT006', null, 'without odds, « autre athlète » is not offered');
select lives_ok($$insert into predictions (user_id, event_id, p1, p2, p3)
  select 'cbcbcbcb-0000-0000-0000-000000000001', plain_event, athletes[1], athletes[6], athletes[2] from fixture$$,
  'without odds, any athlete of the start list can be picked');

select * from finish();
rollback;
