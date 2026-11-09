-- pgTAP: clubs table, import and search (#339).
begin;
select plan(9);

select is(
  import_clubs('[{"name":"Athletic Club de Boulogne Billancourt (ACBB)","city":"Boulogne-Billancourt","department":"92","siren":"111111111"},
                 {"name":"US Créteil Athlétisme","city":"Créteil","department":"94","siren":"222222222"}]'),
  2, 'the import adds the clubs');
select is(
  import_clubs('[{"name":"ACBB Athlétisme","city":"Boulogne-Billancourt","department":"92","siren":"111111111"}]'),
  1, 'importing again updates by SIREN');
select is((select count(*)::int from clubs where siren = '111111111'), 1, 'no duplicate SIREN');
select is((select name from clubs where siren = '111111111'), 'ACBB Athlétisme', 'the name is refreshed');

insert into clubs (name, city, source, created_by)
  values ('Les Foulées Cachées', 'Nulle-Part', 'player', null);

set local role anon;
select is((select count(*)::int from search_clubs('creteil')), 1, 'search ignores accents and case');
select is((select name from search_clubs('BOULOGNE athle')), 'ACBB Athlétisme', 'every word must match');
select is((select count(*)::int from search_clubs('')), 0, 'an empty query finds nothing');
select is((select count(*)::int from search_clubs('cachees')), 0, 'a club to validate is not public');

select throws_ok($$select import_clubs('[]')$$, '42501', null, 'the app cannot import clubs');

select * from finish();
rollback;
