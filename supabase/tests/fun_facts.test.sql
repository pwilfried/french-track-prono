-- pgTAP: « Le saviez-vous ? » (#766). A player reads the active facts and the on/off switch, never
-- a source nor a disabled fact, and writes nothing; only the admin adds, edits, disables, deletes
-- the facts and switches the card. The starting bank is loaded.
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(17);

insert into auth.users (id, email) values
  ('7f0f0000-0000-0000-0000-000000000001', 'admin-facts@example.test'),
  ('7f0f0000-0000-0000-0000-000000000002', 'ana-facts@example.test');
insert into profiles (id, pseudo, age_confirmed_at, is_admin) values
  ('7f0f0000-0000-0000-0000-000000000001', 'Arbitre Faits', now(), true),
  ('7f0f0000-0000-0000-0000-000000000002', 'Ana Faits', now(), false);
insert into competitions (id, slug, name, starts_on, ends_on) values
  ('7f0fc000-0000-0000-0000-000000000001', 'meeting-faits-2031', 'Meeting Faits',
   '2031-07-10', '2031-07-12');

select cmp_ok((select count(*) from fun_facts where active)::int, '>=', 40,
  'the starting bank holds at least 40 active facts');
select is((select count(*) from fun_facts where source = '')::int, 0,
  'every fact of the starting bank has its source');

-- The admin.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "7f0f0000-0000-0000-0000-000000000001", "role": "authenticated"}', true);

select lives_ok($$select set_config('test.fact', admin_save_fun_fact(null, '{
  "title": "Fait de test", "body": "Un fait du meeting.", "tag": "predictions",
  "source": "https://example.test/source", "active": true,
  "competition_slug": "meeting-faits-2031", "discipline": "100 m",
  "starts_on": "2031-07-10", "ends_on": "2031-07-12"}'::jsonb)::text, true)$$,
  'the admin adds a fact tied to a competition, a discipline and dates');
select is((select f ->> 'source' from jsonb_array_elements(admin_fun_facts()) f
           where f ->> 'id' = current_setting('test.fact')),
  'https://example.test/source', 'the admin reads the source of a fact');
select is((select f ->> 'competition_slug' from jsonb_array_elements(admin_fun_facts()) f
           where f ->> 'id' = current_setting('test.fact')),
  'meeting-faits-2031', 'the admin reads the competition of a fact by its slug');
select throws_ok($$select admin_save_fun_fact(null, '{"title": "Autre", "body": "Corps",
  "tag": "bar", "competition_slug": "nulle-part"}'::jsonb)$$, '23503', null,
  'an unknown competition is refused');
select throws_ok($$select admin_save_fun_fact(null, '{"title": "", "body": "Corps",
  "tag": "bar"}'::jsonb)$$, '23514', null, 'an empty title is refused');
select throws_ok($$select admin_save_fun_fact(null, '{"title": "Titre", "body": "Corps",
  "tag": "autre"}'::jsonb)$$, '23514', null, 'an unknown tag is refused');
select lives_ok($$select admin_set_fun_facts_enabled(false)$$, 'the admin switches the card off');

-- The player.
select set_config('request.jwt.claims',
  '{"sub": "7f0f0000-0000-0000-0000-000000000002", "role": "authenticated"}', true);

select is((select title from fun_facts where id = current_setting('test.fact')::uuid),
  'Fait de test', 'a player reads an active fact');
select throws_ok($$select source from fun_facts limit 1$$, '42501', null,
  'a player never reads the source of a fact');
select is((select enabled from fun_fact_settings), false, 'a player reads the on/off switch');
select throws_ok($$select admin_fun_facts()$$, '42501', null,
  'a player does not read the back-office list');
select throws_ok($$select admin_save_fun_fact(null, '{"title": "Moi", "body": "Corps",
  "tag": "bar"}'::jsonb)$$, '42501', null, 'a player does not add a fact');
select throws_ok($$select admin_delete_fun_fact(current_setting('test.fact')::uuid)$$, '42501',
  null, 'a player does not delete a fact');

-- The admin disables, then deletes the fact.
select set_config('request.jwt.claims',
  '{"sub": "7f0f0000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
do $$ begin perform admin_save_fun_fact(current_setting('test.fact')::uuid, '{
  "title": "Fait de test", "body": "Un fait du meeting.", "tag": "predictions",
  "active": false}'::jsonb); end $$;
select set_config('request.jwt.claims',
  '{"sub": "7f0f0000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select is((select count(*) from fun_facts where id = current_setting('test.fact')::uuid)::int, 0,
  'a player does not read a disabled fact');

select set_config('request.jwt.claims',
  '{"sub": "7f0f0000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
do $$ begin perform admin_delete_fun_fact(current_setting('test.fact')::uuid); end $$;
select is((select count(*) from jsonb_array_elements(admin_fun_facts()) f
           where f ->> 'id' = current_setting('test.fact'))::int, 0, 'the admin deletes a fact');

select * from finish();
rollback;
