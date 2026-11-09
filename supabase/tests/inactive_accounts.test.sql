-- pgTAP: accounts without activity for 2 years (#314).
begin;
select plan(9);

-- Three players: old and silent, old but who signed in lately, recent.
insert into auth.users (id, email, last_sign_in_at) values
  ('abababab-0000-0000-0000-000000000001', 'old@example.test', now() - interval '25 months'),
  ('abababab-0000-0000-0000-000000000002', 'back@example.test', now() - interval '2 days'),
  ('abababab-0000-0000-0000-000000000003', 'new@example.test', now());
insert into profiles (id, pseudo, age_confirmed_at, created_at) values
  ('abababab-0000-0000-0000-000000000001', 'Ancien', now(), now() - interval '30 months'),
  ('abababab-0000-0000-0000-000000000002', 'Revenu', now(), now() - interval '30 months'),
  ('abababab-0000-0000-0000-000000000003', 'Nouveau', now(), now());

select is(
  (select array_agg(pseudo order by pseudo) from private.inactive_accounts_to_warn()
   where email like '%@example.test' and pseudo in ('Ancien', 'Revenu', 'Nouveau')),
  array['Ancien'], 'only the silent player is to warn');

select is(private.purge_inactive_accounts() >= 0, true, 'the purge runs');
select is((select count(*)::int from profiles where pseudo = 'Ancien'), 1,
  'nobody is deleted without a warning');

-- Warned 3 weeks ago and still silent: deleted.
select private.mark_inactivity_warned(array['abababab-0000-0000-0000-000000000001'::uuid]);
select is((select count(*)::int from private.inactive_accounts_to_warn() where pseudo = 'Ancien'), 0,
  'a warned player is not warned twice');
update profiles set inactivity_warned_at = now() - interval '22 days'
  where id = 'abababab-0000-0000-0000-000000000001';
select ok(private.purge_inactive_accounts() >= 1, 'the purge deletes the silent player');
select is((select count(*)::int from auth.users where email = 'old@example.test'), 0,
  'his account is gone');
select is((select count(*)::int from profiles where pseudo in ('Revenu', 'Nouveau')), 2,
  'active players stay');

-- A player cannot touch the warning date.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"abababab-0000-0000-0000-000000000003","role":"authenticated"}', true);
select throws_ok($$update profiles set inactivity_warned_at = now() where id = auth.uid()$$,
  '42501', null, 'a player cannot set the warning date');
select throws_ok($$select private.purge_inactive_accounts()$$, '42501', null,
  'the app cannot run the purge');

select * from finish();
rollback;
