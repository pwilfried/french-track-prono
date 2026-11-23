-- pgTAP (#1191): athletes linked to Wikidata, their candidates and the source of each record.
-- A player reads no candidate and writes nothing; the admin links, unlinks, marks absent; the
-- weekly script (service_role) saves a sure link, candidates, an identity and PBs, which replace
-- an unverified PR and never a verified one. Everything is rolled back at the end.
begin;
select plan(20);

insert into auth.users (id, email) values
  ('fbfbfbfb-0000-0000-0000-000000000001', 'player@example.test'),
  ('fbfbfbfb-0000-0000-0000-000000000002', 'admin@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('fbfbfbfb-0000-0000-0000-000000000001', 'Joueur', now()),
  ('fbfbfbfb-0000-0000-0000-000000000002', 'Admin', now());
update profiles set is_admin = true where id = 'fbfbfbfb-0000-0000-0000-000000000002';

create temp table fixture as
select (select id from athletes where slug = 'sha-carri-richardson') as sha,
       (select id from athletes where slug = 'melissa-jefferson-wooden') as mel;
grant select on fixture to authenticated, service_role;

-- A PR of unknown origin, as the 842 unverified rows of the production.
insert into athlete_records (athlete_id, discipline, kind, mark, mark_value, verified, source)
select sha, '400 m', 'pr', '49.90', 49.90, false, null from fixture;

select is(
  (select source from athlete_records where athlete_id = (select mel from fixture)
     and discipline = '100 m' and kind = 'pr'),
  'results', 'a PR set by our results says it comes from them');

-- The script, with the service_role key.
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select ok(admin_wikidata_save_candidates((select sha from fixture),
  '[{"wikidata_id":"Q100","label":"Sha''Carri Richardson","description":"American sprinter","birth_date":"2000-03-25","country_code":"usa"},
    {"wikidata_id":"Q101","label":"Sha''Carri Richardson","description":"another one"}]'),
  'the script saves the candidates of an athlete it cannot link alone');
select is((select wikidata_status from athletes where id = (select sha from fixture)), 'to_review',
  'an athlete with candidates is to review');

select ok(admin_wikidata_save_link((select mel from fixture), 'Q200'), 'the script saves a sure link');
select ok(admin_wikidata_save_identity((select mel from fixture), 'Q200', '2001-02-02',
  'https://en.wikipedia.org/wiki/Melissa_Jefferson-Wooden'), 'the script saves the identity of a linked athlete');
select ok(not admin_wikidata_save_link((select mel from fixture), 'Q201'),
  'the script never changes a link already set');

-- PBs from Wikidata for Melissa: her 100 m PR comes from our results (10.62).
select ok(not admin_wikidata_save_record((select mel from fixture), 'Q200', '100 m', '10.70', 10.70, '2025-08-01', null),
  'a Wikidata PB does not replace a better PR from our results');
select ok(admin_wikidata_save_record((select mel from fixture), 'Q200', '400 m', '50.10', 50.10, null, null),
  'a Wikidata PB is added when there is no PR');
select ok(not admin_wikidata_save_record((select mel from fixture), 'Q999', '200 m', '21.00', 21.00, null, null),
  'a PB of another item than the linked one is not written');

-- A player.
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"fbfbfbfb-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*)::int from athlete_wikidata_candidates), 0, 'a player reads no candidate');
select throws_ok($$select admin_link_athlete_wikidata((select sha from fixture), 'Q100')$$, '42501', null,
  'a player cannot link an athlete');
select throws_ok($$select admin_wikidata_save_record((select mel from fixture), 'Q200', '100 m', '9.00', 9.00, null, null)$$,
  '42501', null, 'a player cannot write a PB');
select throws_ok($$insert into athlete_wikidata_candidates (athlete_id, wikidata_id, label)
  values ((select sha from fixture), 'Q1', 'x')$$, '42501', null, 'a player cannot write a candidate');

-- The admin.
select set_config('request.jwt.claims',
  '{"sub":"fbfbfbfb-0000-0000-0000-000000000002","role":"authenticated"}', true);

select is((select count(*)::int from athlete_wikidata_candidates where athlete_id = (select sha from fixture)), 2,
  'the admin reads the candidates');

select admin_link_athlete_wikidata((select sha from fixture), 'Q100');
select results_eq(
  $$select wikidata_id, wikidata_status,
           (select count(*)::int from athlete_wikidata_candidates where athlete_id = (select sha from fixture))
    from athletes where id = (select sha from fixture)$$,
  $$values ('Q100', 'linked', 0)$$,
  'the admin links an athlete to a candidate, and the candidates go');

select throws_ok($$select admin_link_athlete_wikidata((select mel from fixture), 'Q100')$$, '23505', null,
  'an item is linked to one athlete only');

-- Sha'Carri: an unverified PR of unknown origin (400 m) and a PR typed by the admin (200 m).
select admin_set_athlete_record((select sha from fixture), '200 m', 'pr', '21.92', 21.92, '2023-08-25');
select admin_wikidata_save_record((select sha from fixture), 'Q100', '400 m', '50.20', 50.20, '2019-05-01', 'Meeting');
select admin_wikidata_save_record((select sha from fixture), 'Q100', '200 m', '21.80', 21.80, null, null);
select results_eq(
  $$select discipline, mark, verified, source from athlete_records
    where athlete_id = (select sha from fixture) and discipline in ('200 m', '400 m') and kind = 'pr'
    order by discipline$$,
  $$values ('200 m', '21.92', true, 'admin'), ('400 m', '50.20', false, 'wikidata')$$,
  'a Wikidata PB replaces an unverified PR and never a verified one');

select admin_unlink_athlete_wikidata((select sha from fixture));
select results_eq(
  $$select wikidata_id, wikidata_status,
           (select count(*)::int from athlete_records where athlete_id = (select sha from fixture) and source = 'wikidata')
    from athletes where id = (select sha from fixture)$$,
  $$values (null::text, 'unknown', 0)$$,
  'the admin undoes a link: back to unknown, without the PBs of the item');

select admin_mark_athlete_absent_from_wikidata((select sha from fixture));
select is((select wikidata_status from athletes where id = (select sha from fixture)), 'absent',
  'the admin marks an athlete absent from Wikidata');

reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select ok(not admin_wikidata_save_candidates((select sha from fixture), '[]'),
  'the script leaves an athlete marked absent alone');

select * from finish();
rollback;
