-- pgTAP: a competition is indoor or outdoor (#642), outdoor by default; the back-office sets it.
begin;
select plan(9);

insert into auth.users (id, email) values
  ('ababab64-0000-0000-0000-000000000001', 'admin@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('ababab64-0000-0000-0000-000000000001', 'Admin', now());
update profiles set is_admin = true where id = 'ababab64-0000-0000-0000-000000000001';

insert into competitions (slug, name, starts_on, ends_on)
values ('venue-default-test', 'Venue test', current_date + 5, current_date + 6);
select is((select venue from competitions where slug = 'venue-default-test'), 'outdoor',
  'a competition without a venue is outdoor');

select throws_ok($$insert into competitions (slug, name, venue, starts_on, ends_on)
  values ('venue-unknown-test', 'Venue test', 'beach', current_date, current_date)$$,
  '23514', null, 'an unknown venue is refused');

-- The backfill: the World Indoor Tour and the European Indoor Championships are indoor.
select is(private.competition_venue('world-indoor-tour-karlsruhe-2027'), 'indoor',
  'the backfill marks a World Indoor Tour meeting indoor');
select is(private.competition_venue('european-indoor-championships-2027'), 'indoor',
  'the backfill marks the European Indoor Championships indoor');
select is(private.competition_venue('ultimate-championship-2026'), 'outdoor',
  'the backfill leaves the other competitions outdoor');
select is_empty($$select slug from competitions
  where slug <> 'venue-default-test' and venue <> private.competition_venue(slug)$$,
  'every competition already in base got its venue');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"ababab64-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(admin_create_competition('venue-indoor-test', 'Venue salle', 'international', '', '',
  current_date + 30, current_date + 31, 'indoor'), 'venue-indoor-test', 'an admin creates an indoor competition');
select is((select venue from competitions where slug = 'venue-indoor-test'), 'indoor',
  'the venue is stored');

select admin_update_competition('venue-indoor-test', 'Venue salle', 'international', '', '',
  current_date + 30, current_date + 31, 'outdoor');
select is((select venue from competitions where slug = 'venue-indoor-test'), 'outdoor',
  'an admin moves a competition outdoors');

select * from finish();
rollback;
