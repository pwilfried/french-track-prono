-- What a run of the end-to-end tests leaves in pre-production (#695), deleted at the end of each
-- run, failed or not (e2e/teardown.ts, then preprod.yml or daily.yml again). The demo set and
-- the public seed never use these names. Locally and in the CI of each PR, the teardown then
-- checks that nothing the run made is left (e2e/leftovers.ts, #947): a name a test starts using
-- goes here too.
-- One request: a statement that fails undoes them all, so each one only deletes what nothing
-- else still needs.

-- Clubs typed by test accounts (« Les Foulées … » at sign-up), before the accounts go and leave
-- them without author, and the clubs the club tests make (#947).
delete from clubs
where created_by in (select id from auth.users
                     where email like 'e2e-%@example.test' or email like 'moved-e2e-%@example.test')
   or name ~ '^(Club Zeta e2e-clubs-[0-9]+|Foulees Zclub [0-9]+|Foulées du Val [0-9]+|AC Zmerge[0-9]+|Athletic Club de Zmerge[0-9]+|Foulees Notice [0-9]+)$';

-- Test accounts (e-mails e2e-…@example.test, or moved-e2e-… after an e-mail change): their
-- profile, leagues, Manager leagues (« Sprinteurs <n> »…), predictions and points go with them
-- (on delete cascade), so they leave every ranking too.
delete from auth.users
where email like 'e2e-%@example.test' or email like 'moved-e2e-%@example.test';

-- « E2E … » leagues, should one outlive its owner's account.
delete from leagues where name like 'E2E %' or name = 'Ligue E2E';

-- Competitions made by the tests (test-…, e2e-…): their events, entries and results go with them.
delete from competitions where slug like 'test-%' or slug like 'e2e-%';

-- Competitions made by the Manager, feed and result-sheet tests (#788, #947), left behind when a
-- test fails before its own cleanup: a prefix, then the run's number (mduel-1-123456,
-- align-bare-123456 « Meeting Vide … », feed-123456…).
delete from competitions
where slug ~ '^(align|align-bare|feed|mduel|mend|mchamp|mhome|mpts|sheet|paste|manager|manager-soon)-([0-9]+-)?[0-9]+$';

-- Athletes made by the tests (#947): a prefix, then the run's number (sheet-0-123456,
-- mduel-a-3-123456, enchere-une-123456…); the invented ones of the admin and start-list tests.
-- Never one a prediction left outside the tests still names (it would undo the whole clean-up).
delete from athletes a
where not exists (select 1 from predictions p where a.id in (p.p1, p.p2, p.p3))
  and (slug ~ '^(sheet|mduel|mpts|paste|align|mend|feed|fil-manager|enchere|lanceuse-catalogue|equipe)-([a-z0-9]+-)*[0-9]+$'
    or slug like 'inventee-e2e-%'
    or (slug ~ '^inventee-[a-z]{8}$' and name ~ '^Inventée [A-Z][a-z]{7}$'));

-- Disciplines made by the admin test (#947), once nothing uses them any more.
delete from disciplines d
where d.name ~ '^Mile E2E [0-9]+$'
  and not exists (select 1 from events e where e.discipline = d.name)
  and not exists (select 1 from athlete_disciplines a where a.discipline = d.name)
  and not exists (select 1 from athlete_records r where r.discipline = d.name);

-- Polls, episodes and fun facts of the community and fun-fact tests (#673, #947).
delete from polls where question like 'E2E %';
delete from announcements where title like 'E2E %';
delete from fun_facts where title like 'Fait E2E %';
