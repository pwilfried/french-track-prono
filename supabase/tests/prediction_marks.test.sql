-- pgTAP: predicted marks (#261) are stored with the podium and locked like it. Rolled back at the end.
begin;
select plan(4);

insert into auth.users (id, email) values ('cdcdcdcd-0000-0000-0000-000000000001', 'player@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values ('cdcdcdcd-0000-0000-0000-000000000001', 'Joueur', now());

create temp table fixture as
with c as (
  insert into competitions (slug, name, starts_on, ends_on)
  values ('marks-test', 'Marks test', current_date + 2, current_date + 3) returning id
), e as (
  insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
  select id, 'marks-test-100m', '100 m', 'F', now() + interval '2 days', now() + interval '2 days' from c
  returning id
)
select e.id as event_id, array(select id from athletes order by id limit 3) as athletes from e;
insert into entries (event_id, athlete_id) select event_id, unnest(athletes) from fixture;
grant select on fixture to authenticated;

-- #311: a player predicts from a league of the competition; each test player gets his own.
insert into leagues (name, owner_id) select 'Test ' || pseudo, id from profiles where created_at = now();
insert into league_members (league_id, user_id, role)
select l.id, l.owner_id, 'owner' from leagues l join profiles p on p.id = l.owner_id where p.created_at = now();
insert into league_competitions (league_id, competition_id)
select l.id, c.id from leagues l join profiles p on p.id = l.owner_id, competitions c where p.created_at = now();

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cdcdcdcd-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok($$insert into predictions (user_id, event_id, p1, p2, p3, m1, m3)
  select 'cdcdcdcd-0000-0000-0000-000000000001', event_id, athletes[1], athletes[2], athletes[3], 10.85, 11.02
  from fixture$$, 'a player predicts marks for some of his athletes');
select throws_ok($$update predictions set m2 = 0 where event_id = (select event_id from fixture)$$,
  '23514', null, 'a mark is a positive number');

reset role;
update events set lock_at = now() - interval '1 minute', starts_at = now()
where id = (select event_id from fixture);
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cdcdcdcd-0000-0000-0000-000000000001","role":"authenticated"}', true);

select throws_ok($$update predictions set m1 = 10.70 where event_id = (select event_id from fixture)$$,
  'P0001', null, 'a mark cannot change once the event is locked');
select is((select m1 from predictions where event_id = (select event_id from fixture)), 10.85::numeric,
  'the mark predicted before the lock stays');

select * from finish();
rollback;
