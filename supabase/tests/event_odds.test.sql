-- pgTAP: the admin sets the odds of an event before it locks; with odds enabled, predictions open
-- only once odds are set. Everything is rolled back at the end.
begin;
select plan(8);

insert into auth.users (id, email) values
  ('cacacaca-0000-0000-0000-000000000001', 'player@example.test'),
  ('cacacaca-0000-0000-0000-000000000002', 'admin@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('cacacaca-0000-0000-0000-000000000001', 'Joueur', now()),
  ('cacacaca-0000-0000-0000-000000000002', 'Admin', now());
update profiles set is_admin = true where id = 'cacacaca-0000-0000-0000-000000000002';

-- A competition with odds, an open event with 7 athletes on its start list.
create temp table fixture as
with c as (
  insert into competitions (slug, name, starts_on, ends_on, odds_enabled)
  values ('odds-test', 'Odds test', current_date + 2, current_date + 3, true) returning id
), e as (
  insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
  select id, 'odds-test-f-100m', '100 m', 'F', now() + interval '2 days', now() + interval '2 days' from c
  returning id
)
select e.id as event_id, array(select id from athletes order by id limit 7) as athletes from e;
insert into entries (event_id, athlete_id) select event_id, unnest(athletes) from fixture;
grant select on fixture to authenticated;

create function odds_of(p_count int) returns jsonb language sql stable as $$
  select jsonb_agg(jsonb_build_object('athlete_id', athletes[i], 'odds', 1 + i * 0.5))
         || jsonb_build_array(jsonb_build_object('athlete_id', null, 'odds', 8))
  from fixture, generate_series(1, p_count) i
$$;
grant execute on function odds_of(int) to authenticated;

select ok(not is_predictable((select event_id from fixture)), 'without odds the event is not open');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cacacaca-0000-0000-0000-000000000002","role":"authenticated"}', true);

select throws_ok($$select admin_set_event_odds((select event_id from fixture),
  jsonb_build_array(jsonb_build_object('athlete_id', null, 'odds', 8)))$$, '22023', null,
  'at least one athlete is proposed');
select lives_ok($$select admin_set_event_odds((select event_id from fixture), jsonb_build_array(
  jsonb_build_object('athlete_id', (select athletes[1] from fixture), 'odds', 1),
  jsonb_build_object('athlete_id', null, 'odds', 0.8)))$$,
  'one athlete is enough, and odds of 1 or below are accepted (#294)');
select lives_ok($$select admin_set_event_odds((select event_id from fixture), odds_of(6))$$,
  'an admin sets odds for six athletes and another athlete');
select is((select count(*)::int from event_odds where event_id = (select event_id from fixture)), 7,
  'seven odds are stored');
select ok(is_predictable((select event_id from fixture)), 'with odds the event opens');

select set_config('request.jwt.claims',
  '{"sub":"cacacaca-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$select admin_set_event_odds((select event_id from fixture), odds_of(5))$$, '42501', null,
  'a player cannot set odds');

reset role;
update events set lock_at = now() - interval '1 minute', starts_at = now() where id = (select event_id from fixture);
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cacacaca-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$select admin_set_event_odds((select event_id from fixture), odds_of(5))$$, 'FT005', null,
  'odds are frozen once the event is locked');

select * from finish();
rollback;
