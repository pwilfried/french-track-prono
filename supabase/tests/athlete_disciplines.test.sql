-- pgTAP: start lists tell which disciplines an athlete runs; visitors read them, players cannot
-- write them. Everything is rolled back at the end.
begin;
select plan(6);

select ok((select count(*) from athlete_disciplines) >= 50,
  'the seed start lists give at least 50 athlete disciplines');

-- Two athletes of the seed; one becomes a 200 m runner through a new start list.
create temp table fixture as
select (select id from athletes where slug = 'sha-carri-richardson') as sprinter,
       (select id from athletes where slug = 'yaroslava-mahuchikh') as jumper;
grant select on fixture to authenticated;
insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
select id, 'disciplines-200m', '200 m', 'F', now() + interval '1 day', now() + interval '1 day'
from competitions limit 1;
insert into entries (event_id, athlete_id)
select (select id from events where slug = 'disciplines-200m'), sprinter from fixture;

select is(
  (select is_primary from athlete_disciplines
    where athlete_id = (select sprinter from fixture) and discipline = '200 m'),
  false, 'a new discipline does not replace the main one');

select results_eq(
  $$select a.slug from athletes a join athlete_disciplines d on d.athlete_id = a.id
    where d.discipline = '100 m' and a.slug in ('sha-carri-richardson', 'yaroslava-mahuchikh')$$,
  $$values ('sha-carri-richardson')$$,
  'an athlete without the discipline is left out of its filter');

select is(
  (select is_primary from athlete_disciplines where discipline = '100 m'
    order by is_primary desc limit 1),
  true, 'a main discipline comes first in the sort');

set local role anon;
select ok((select count(*) from athlete_disciplines) > 0, 'a visitor reads the disciplines');

set local role authenticated;
select throws_ok(
  $$insert into athlete_disciplines (athlete_id, discipline)
    values ((select jumper from fixture), '100 m')$$,
  '42501', null, 'a player cannot add a discipline');

select * from finish();
rollback;
