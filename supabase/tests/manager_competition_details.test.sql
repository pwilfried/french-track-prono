-- pgTAP (#663): the competitions a Manager league can be created with tell their city, scope,
-- venue and level, for the picker. Rolled back at the end.
begin;
select plan(2);

insert into auth.users (id, email) values
  ('adadad00-0000-0000-0000-000000000001', 'picker@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('adadad00-0000-0000-0000-000000000001', 'Selecteur', now());

insert into competitions (slug, name, city, scope, venue, level, starts_on, ends_on) values
  ('tap-picker-dl', 'Meeting Picker', 'Oslo', 'international', 'outdoor', 'diamond-league',
   current_date + 40, current_date + 40),
  ('tap-picker-fr', 'France Picker', null, 'france', 'indoor', null,
   current_date + 50, current_date + 50);
insert into manager_competitions (competition_id)
select id from competitions where slug like 'tap-picker-%';

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"adadad00-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(
  (select row(city, scope, venue, level)::text from list_manager_available_competitions()
   where name = 'Meeting Picker'),
  '(Oslo,international,outdoor,diamond-league)',
  'a competition tells its city, scope, venue and level');
select is(
  (select row(city, scope, venue, level)::text from list_manager_available_competitions()
   where name = 'France Picker'),
  '(,france,indoor,)',
  'without a city or a level, both are null');

select * from finish();
rollback;
