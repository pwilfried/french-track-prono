-- What a run of the end-to-end tests leaves in pre-production (#695), deleted at the end of each
-- run, failed or not (e2e/teardown.ts, then preprod.yml or daily.yml again). The demo set and
-- the public seed never use these names.
-- Test accounts (e-mails e2e-…@example.test, or moved-e2e-… after an e-mail change): their
-- profile, leagues, predictions and points go with them (on delete cascade), so they leave
-- every ranking too.
delete from auth.users
where email like 'e2e-%@example.test' or email like 'moved-e2e-%@example.test';

-- « E2E … » leagues, should one outlive its owner's account.
delete from leagues where name like 'E2E %' or name = 'Ligue E2E';

-- Competitions made by the tests (test-…, e2e-…): their events, entries and results go with them.
delete from competitions where slug like 'test-%' or slug like 'e2e-%';

-- Competitions made by the Manager and result-sheet tests (#788), left behind when a test fails
-- before its own cleanup: same prefix, then the run's number (mduel-1-123456, align-123456…).
delete from competitions
where slug ~ '^(align|mduel|mend|mchamp|mhome|mpts|sheet|paste|manager|manager-soon)-([0-9]+-)?[0-9]+$';
