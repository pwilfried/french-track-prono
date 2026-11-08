-- pgTAP: the admin adjusts the scale (#262); a player cannot. Rolled back at the end.
begin;
select plan(6);

insert into auth.users (id, email) values
  ('cececece-0000-0000-0000-000000000001', 'admin@example.test'),
  ('cececece-0000-0000-0000-000000000002', 'player@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('cececece-0000-0000-0000-000000000001', 'Admin', now()),
  ('cececece-0000-0000-0000-000000000002', 'Joueur', now());
update profiles set is_admin = true where id = 'cececece-0000-0000-0000-000000000001';

select is((select value from scoring_rules where key = 'mark_exact'), 5::numeric,
  'a mark within the tolerance is worth 5 points by default');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"cececece-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($$select admin_set_scoring_rule('odds_exact', 4)$$, 'an admin changes a value');
select is((select value from scoring_rules where key = 'odds_exact'), 4::numeric, 'the new value is kept');
select throws_ok($$select admin_set_scoring_rule('odds_exact', 0)$$, '22023', null, 'a value is positive');
select throws_ok($$select admin_set_scoring_rule('no_such_rule', 2)$$, 'FT007', null, 'an unknown rule is refused');

select set_config('request.jwt.claims',
  '{"sub":"cececece-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$select admin_set_scoring_rule('odds_exact', 9)$$, '42501', null, 'a player cannot change the scale');

select * from finish();
rollback;
