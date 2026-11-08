-- pgTAP: marks are compared as numbers in the right direction, and official results keep the PR
-- and SB up to date. Everything is rolled back at the end.
begin;
select plan(16);

-- Reading marks.
select is(parse_mark('10.78'), 10.78, 'a sprint time in seconds');
select is(parse_mark('1:56.70'), 116.70, 'a time in minutes');
select is(parse_mark('2:05:30'), 7530::numeric, 'a time in hours');
select is(parse_mark('2m34'), 2.34, 'a height written 2m34');
select is(parse_mark('8,12 m'), 8.12, 'a distance with a comma and a unit');
select is(parse_mark('10.62 (+0.4)'), 10.62, 'the wind reading is ignored');
select is(parse_mark('DNF'), null, 'no number, no mark');

-- Comparing marks.
select ok(is_better_mark('100 m', 10.85, 10.78), 'a lower time is better (10.78 beats 10.85)');
select ok(is_better_mark('Saut en hauteur', 2.31, 2.34), 'a higher bar is better (2.34 beats 2.31)');
select ok(is_better_mark('Saut en longueur', 7.01, 7.12), 'a longer jump is better');
select ok(not is_better_mark('400 m haies', 52.10, 52.80), 'a slower hurdles race is worse');

-- Backfill and trigger, on an athlete of the seed (the backfill ran on the seed results).
select is(
  (select mark from athlete_records r join athletes a on a.id = r.athlete_id
    where a.slug = 'melissa-jefferson-wooden' and r.discipline = '100 m' and r.kind = 'pr'),
  '10.62', 'the seed results give each podium athlete a PR');

-- A new event of the same discipline later in 2026 where she runs faster, then one slower.
create temp table fixture as
with c as (select id from competitions where slug = 'ultimate-championship-2026'),
e as (
  insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
  select c.id, slug, '100 m', 'F', at, at from c,
    (values ('records-fast', timestamptz '2026-10-01 18:00Z'),
            ('records-slow', timestamptz '2026-10-02 18:00Z'),
            ('records-next-year', timestamptz '2027-05-01 18:00Z')) v(slug, at)
  returning id, slug
)
select e.id as event_id, e.slug, a.id as athlete_id
from e, athletes a where a.slug = 'melissa-jefferson-wooden';
insert into entries (event_id, athlete_id) select event_id, athlete_id from fixture;

insert into results (event_id, athlete_id, rank, mark)
select event_id, athlete_id, 1, '10.58' from fixture where slug = 'records-fast';

select is(
  (select mark from athlete_records r join fixture f using (athlete_id)
    where f.slug = 'records-fast' and r.discipline = '100 m' and r.kind = 'pr'),
  '10.58', 'a result better than the PR becomes the PR');

insert into results (event_id, athlete_id, rank, mark)
select event_id, athlete_id, 1, '10.90' from fixture where slug = 'records-slow';

select is(
  (select mark from athlete_records r join fixture f using (athlete_id)
    where f.slug = 'records-slow' and r.discipline = '100 m' and r.kind = 'sb'),
  '10.58', 'a result worse than the season best does not overwrite it');

insert into results (event_id, athlete_id, rank, mark)
select event_id, athlete_id, 1, '10.95' from fixture where slug = 'records-next-year';

select results_eq(
  $$select kind, mark from athlete_records r join fixture f using (athlete_id)
    where f.slug = 'records-next-year' and r.discipline = '100 m' and r.kind in ('pr', 'sb')
    order by kind$$,
  $$values ('pr', '10.58'), ('sb', '10.95')$$,
  'the first result of a new year starts a new season best and keeps the PR');

set local role anon;
select ok((select count(*) from athlete_records) > 0, 'a visitor reads the records');

select * from finish();
rollback;
