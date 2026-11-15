-- pgTAP: reactions to the moments of a league (#672). Only members react, in their own name, with
-- the fixed codes; a report per player and item; only the admin hides, and a hidden item is read
-- by nobody. The player of the moment gets one grouped notification an hour at most.
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(25);

insert into auth.users (id, email) values
  ('f6720000-0000-0000-0000-000000000001', 'ana@example.test'),
  ('f6720000-0000-0000-0000-000000000002', 'bob@example.test'),
  ('f6720000-0000-0000-0000-000000000003', 'cid@example.test'),
  ('f6720000-0000-0000-0000-000000000004', 'admin@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('f6720000-0000-0000-0000-000000000001', 'Ana672', now()),
  ('f6720000-0000-0000-0000-000000000002', 'Bob672', now()),
  ('f6720000-0000-0000-0000-000000000003', 'Cid672', now()),
  ('f6720000-0000-0000-0000-000000000004', 'Admin672', now());
update profiles set is_admin = true where id = 'f6720000-0000-0000-0000-000000000004';

create temp table ctx (league uuid, reaction uuid);
grant all on ctx to authenticated;
with l as (insert into leagues (name, owner_id)
           values ('Réactions', 'f6720000-0000-0000-0000-000000000001') returning id)
insert into ctx (league) select id from l;
insert into league_members (league_id, user_id, role)
select league, 'f6720000-0000-0000-0000-000000000001'::uuid, 'owner'::league_role from ctx
union all
select league, 'f6720000-0000-0000-0000-000000000002'::uuid, 'member'::league_role from ctx;
insert into league_moments (league_id, key, kind, user_id)
select league, 'new_leader:e1:ana', 'new_leader', 'f6720000-0000-0000-0000-000000000001' from ctx;

-- Bob, a member, reacts and sends a message.
select set_config('request.jwt.claims',
  json_build_object('sub', 'f6720000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;
select lives_ok($$ select add_moment_reaction((select league from ctx), 'new_leader:e1:ana', 'fire') $$,
  'a member reacts to a moment of their league');
select lives_ok($$ select add_moment_reaction((select league from ctx), 'new_leader:e1:ana', 'fire') $$,
  'the same emoji again changes nothing');
select is((select count(*) from moment_reactions r, ctx c
           where r.league_id = c.league and r.kind = 'emoji'), 1::bigint,
  'one emoji of each sort per player');
select throws_ok(
  $$ select add_moment_reaction((select league from ctx), 'new_leader:e1:ana', 'clown') $$,
  '23514', null, 'an emoji out of the list is refused');
select throws_ok(
  $$ select send_moment_message((select league from ctx), 'new_leader:e1:ana', 'Salut à tous') $$,
  '23514', null, 'a message out of the list is refused');
select lives_ok(
  $$ select send_moment_message((select league from ctx), 'new_leader:e1:ana', 'well_played') $$,
  'a member sends a preset message');
select lives_ok(
  $$ select send_moment_message((select league from ctx), 'new_leader:e1:ana', 'rematch') $$,
  'a second message replaces the first');
select results_eq(
  $$ select code, pseudo from league_feed_reactions((select league from ctx)) where kind = 'message' $$,
  $$ values ('rematch'::text, 'Bob672'::text) $$,
  'one message per player and moment, with the pseudo');
select throws_ok(
  $$ insert into moment_reactions (league_id, moment_key, user_id, kind, code)
     select league, 'new_leader:e1:ana', 'f6720000-0000-0000-0000-000000000001', 'emoji', 'clap'
     from ctx $$,
  '42501', null, 'a player cannot react in someone else''s name');
select throws_ok($$ update moment_reactions set code = 'clap' $$,
  '42501', null, 'a player cannot change a reaction directly');
select lives_ok(
  $$ select remove_moment_reaction((select league from ctx), 'new_leader:e1:ana', 'fire') $$,
  'a member removes their emoji');
select is((select count(*) from moment_reactions r, ctx c
           where r.league_id = c.league and r.kind = 'emoji'), 0::bigint,
  'the removed emoji is gone');
reset role;
update ctx set reaction = (select r.id from moment_reactions r, ctx c
                           where r.league_id = c.league and r.kind = 'message');

-- Cid, outside the league, neither reacts nor reads.
select set_config('request.jwt.claims',
  json_build_object('sub', 'f6720000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
set local role authenticated;
select throws_ok(
  $$ select add_moment_reaction((select league from ctx), 'new_leader:e1:ana', 'fire') $$,
  '42501', null, 'someone outside the league cannot react');
select is((select count(*) from league_feed_reactions((select league from ctx))), 0::bigint,
  'someone outside the league reads no reaction');
reset role;

-- Ana reports Bob's message, twice: one report.
select set_config('request.jwt.claims',
  json_build_object('sub', 'f6720000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;
select lives_ok($$ select report_moment_reaction((select reaction from ctx)) $$,
  'a member reports a message');
select lives_ok($$ select report_moment_reaction((select reaction from ctx)) $$,
  'reporting it again changes nothing');
select is((select count(*) from moment_reaction_reports r, ctx c where r.reaction_id = c.reaction),
  1::bigint,
  'a player reports the same item once');
select throws_ok($$ select admin_hide_moment_reaction((select reaction from ctx)) $$,
  '42501', null, 'a player cannot hide a reaction');
reset role;

-- The admin hides it: nobody reads it any more.
select set_config('request.jwt.claims',
  json_build_object('sub', 'f6720000-0000-0000-0000-000000000004', 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select count(*) from admin_list_moment_reports(), ctx c
           where reaction_id = c.reaction), 1::bigint,
  'the admin sees the reported message');
select lives_ok($$ select admin_hide_moment_reaction((select reaction from ctx)) $$,
  'the admin hides it');
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', 'f6720000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select count(*) from league_feed_reactions((select league from ctx))), 0::bigint,
  'a hidden message is read by no member, not even its author');
reset role;

-- Bob reacts again: Ana, with a device and no quiet hours, gets one grouped notification.
select set_config('request.jwt.claims',
  json_build_object('sub', 'f6720000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;
select add_moment_reaction((select league from ctx), 'new_leader:e1:ana', 'clap');
select add_moment_reaction((select league from ctx), 'new_leader:e1:ana', 'wow');
reset role;
insert into push_subscriptions (endpoint, user_id, p256dh, auth)
values ('https://push.example.test/ana672', 'f6720000-0000-0000-0000-000000000001', 'k', 'a');
insert into reminder_settings (user_id, quiet_from, quiet_to)
values ('f6720000-0000-0000-0000-000000000001', 0, 0);
select results_eq(
  $$ select kind, payload ->> 'count', payload ->> 'pseudo', payload ->> 'league_name'
     from private.reminder_due()
     where user_id = 'f6720000-0000-0000-0000-000000000001' $$,
  $$ values ('moment_reaction'::text, '2'::text, 'Bob672'::text, 'Réactions'::text) $$,
  'the player of the moment gets one notification for the reactions, not the hidden message');
select is(
  (select count(*) from private.moment_reaction_due()
   where user_id = 'f6720000-0000-0000-0000-000000000002'), 0::bigint,
  'whoever reacts is not notified');
select private.reminder_mark_sent(
  (select jsonb_agg(jsonb_build_object('user_id', user_id, 'kind', kind, 'evening', evening, 'ref', ref))
   from private.reminder_due() where user_id = 'f6720000-0000-0000-0000-000000000001'));
select is(
  (select count(*) from private.moment_reaction_due(now() + interval '30 minutes')
   where user_id = 'f6720000-0000-0000-0000-000000000001'), 0::bigint,
  'nothing more within the hour');
update moment_reactions set created_at = now() + interval '61 minutes'
where league_id = (select league from ctx) and code = 'wow';
update reminder_log set sent_at = now()
where user_id = 'f6720000-0000-0000-0000-000000000001' and kind = 'moment_reaction';
select results_eq(
  $$ select payload ->> 'count' from private.moment_reaction_due(now() + interval '62 minutes')
     where user_id = 'f6720000-0000-0000-0000-000000000001' $$,
  $$ values ('1'::text) $$,
  'an hour later, only what came since the last one');

select * from finish();
rollback;
