-- Deletes the accounts the e2e suite created on pre-production (#636, #634): invented players
-- `e2e-…@example.test`. Their profile, leagues, predictions and teams go with them (on delete
-- cascade). Run after every pass, failed or not; the demo players are never touched.
delete from auth.users where email like 'e2e-%@example.test';
