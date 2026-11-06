-- v0.2 Accounts: age confirmation and a pseudo that is unique whatever the case.

-- "15 or older" box: a profile cannot exist without it (see docs/architecture.md).
alter table profiles add column age_confirmed_at timestamptz;
update profiles set age_confirmed_at = created_at where age_confirmed_at is null;
alter table profiles alter column age_confirmed_at set not null;

-- "Anna" and "anna" are the same pseudo: replace the case-sensitive unique constraint.
alter table profiles drop constraint profiles_pseudo_key;
create unique index profiles_pseudo_lower_key on profiles (lower(pseudo));
