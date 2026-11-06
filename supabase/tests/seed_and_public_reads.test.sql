-- pgTAP: seed health and public reads. Run with `supabase test db`.
begin;
select plan(13);

-- Seed health ---------------------------------------------------------------
select is((select count(*) from events), 28::bigint, 'the seed has 28 events');
select is((select count(*) from results), 91::bigint, 'the seed has 91 results');
select is((select count(*) from athletes), 86::bigint, 'the seed has 86 athletes and teams');

select is(
  (select count(*) from events e
    where (select count(distinct r.rank) from results r where r.event_id = e.id and r.rank <= 3) <> 3),
  0::bigint,
  'every event has ranks 1, 2 and 3 in its results');

select is(
  (select count(*) from events e
    where (select count(*) from results r where r.event_id = e.id and r.rank = 1) <> 1),
  0::bigint,
  'every event has exactly one winner');

select is(
  (select count(*) from results r
    where not exists (select 1 from entries en where en.event_id = r.event_id and en.athlete_id = r.athlete_id)),
  0::bigint,
  'every result athlete is in the entries of the event');

select is(
  (select count(*) from events where lock_at <> starts_at - interval '5 minutes'),
  0::bigint,
  'every event locks 5 minutes before its start');

-- Public reads: no account needed in v0.1 -----------------------------------
set local role anon;
select is((select count(*) from events), 28::bigint, 'an anonymous visitor can read events');
select is((select count(*) from results), 91::bigint, 'an anonymous visitor can read results');
select is((select count(*) from entries), 91::bigint, 'an anonymous visitor can read entries');
select cmp_ok((select count(*) from athletes), '>', 0::bigint, 'an anonymous visitor can read athletes');
select cmp_ok((select count(*) from competitions), '>', 0::bigint, 'an anonymous visitor can read competitions');

reset role;
set local role authenticated;
select is((select count(*) from events), 28::bigint, 'a signed-in player can read events');

select * from finish();
rollback;
