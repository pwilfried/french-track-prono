-- pgTAP: the season trophies (#822). A player reads their trophies and those of the players of
-- their leagues, nobody writes them; the admin replaces a season's trophies in one go (drawing
-- them again never duplicates one) and sets the FrenchTrack account of the Témoin d'or.
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(17);

insert into auth.users (id, email) values
  ('7a0f0000-0000-0000-0000-000000000001', 'admin-trophies@example.test'),
  ('7a0f0000-0000-0000-0000-000000000002', 'ana-trophies@example.test'),
  ('7a0f0000-0000-0000-0000-000000000003', 'bob-trophies@example.test'),
  ('7a0f0000-0000-0000-0000-000000000004', 'max-trophies@example.test');
insert into profiles (id, pseudo, age_confirmed_at, is_admin) values
  ('7a0f0000-0000-0000-0000-000000000001', 'Arbitre Trophees', now(), true),
  ('7a0f0000-0000-0000-0000-000000000002', 'Ana Trophees', now(), false),
  ('7a0f0000-0000-0000-0000-000000000003', 'Bob Trophees', now(), false),
  ('7a0f0000-0000-0000-0000-000000000004', 'Max Trophees', now(), false);
insert into competitions (id, slug, name, starts_on, ends_on) values
  ('7a0fc000-0000-0000-0000-000000000001', 'meeting-trophees-2031', 'Meeting Trophées',
   '2031-07-10', '2031-07-12');
insert into leagues (id, name, owner_id) values
  ('7a0f1000-0000-0000-0000-000000000001', 'Ligue Trophées', '7a0f0000-0000-0000-0000-000000000002');
insert into league_members (league_id, user_id, role) values
  ('7a0f1000-0000-0000-0000-000000000001', '7a0f0000-0000-0000-0000-000000000002', 'owner'),
  ('7a0f1000-0000-0000-0000-000000000001', '7a0f0000-0000-0000-0000-000000000003', 'member');
insert into league_competitions (league_id, competition_id) values
  ('7a0f1000-0000-0000-0000-000000000001', '7a0fc000-0000-0000-0000-000000000001');

-- The admin awards the 2031 trophies.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "7a0f0000-0000-0000-0000-000000000001", "role": "authenticated"}', true);

select is(admin_set_trophy_witness('ana TROPHEES'), 'saved',
  'the admin designates the FrenchTrack account by its pseudo, whatever the case');
select is(admin_trophy_witness(), 'Ana Trophees', 'the admin reads the FrenchTrack account');
select is(admin_set_trophy_witness('Personne'), 'unknown', 'an unknown pseudo is refused');
select is(admin_trophy_witness(), 'Ana Trophees', 'an unknown pseudo changes nothing');

select is((admin_trophy_facts(2031) -> 'leagues' -> 0 ->> 'name'), 'Ligue Trophées',
  'the facts of a season list the leagues whose last competition ends in it');
select is(jsonb_array_length(admin_trophy_facts(2031) -> 'leagues' -> 0 -> 'members'), 2,
  'the facts list the members of a league');
select is((admin_trophy_facts(2031) ->> 'witness_id')::uuid,
  '7a0f0000-0000-0000-0000-000000000002'::uuid, 'the facts carry the FrenchTrack account');

select lives_ok($$select admin_replace_trophies(2031, '[
  {"user_id": "7a0f0000-0000-0000-0000-000000000002", "kind": "league", "metal": "gold",
   "league_id": "7a0f1000-0000-0000-0000-000000000001", "league_name": "Ligue Trophées",
   "animal": "cheetah"},
  {"user_id": "7a0f0000-0000-0000-0000-000000000003", "kind": "general", "metal": "bronze"},
  {"user_id": "7a0f0000-0000-0000-0000-000000000004", "kind": "witness"}
]'::jsonb)$$, 'the admin awards the trophies of a season');
select lives_ok($$select admin_replace_trophies(2031, '[
  {"user_id": "7a0f0000-0000-0000-0000-000000000002", "kind": "league", "metal": "gold",
   "league_id": "7a0f1000-0000-0000-0000-000000000001", "league_name": "Ligue Trophées",
   "animal": "cheetah"},
  {"user_id": "7a0f0000-0000-0000-0000-000000000002", "kind": "league", "metal": "gold",
   "league_id": "7a0f1000-0000-0000-0000-000000000001", "league_name": "Ligue Trophées",
   "animal": "cheetah"},
  {"user_id": "7a0f0000-0000-0000-0000-000000000003", "kind": "general", "metal": "bronze"},
  {"user_id": "7a0f0000-0000-0000-0000-000000000004", "kind": "witness"}
]'::jsonb)$$, 'the admin draws the trophies again, one sent twice');

reset role;
select is((select count(*) from trophies where season = 2031), 3::bigint,
  'drawing the trophies again replaces them, without any duplicate');
select throws_ok(
  $$insert into trophies (user_id, season, kind) values
    ('7a0f0000-0000-0000-0000-000000000002', 2031, 'league')$$,
  '23514', null, 'a trophy of a ranking needs a metal and a league');

-- Ana sees her trophies and Bob's (same league), not Max's.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "7a0f0000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select results_eq(
  $$select kind from trophies where season = 2031 order by kind$$,
  $$values ('general'::text), ('league'::text)$$,
  'a player reads their trophies and those of the players of their leagues, no one else''s');

-- Max sees his own only, and cannot write.
select set_config('request.jwt.claims',
  '{"sub": "7a0f0000-0000-0000-0000-000000000004", "role": "authenticated"}', true);
select results_eq($$select kind from trophies where season = 2031$$, $$values ('witness'::text)$$,
  'a player outside the league reads only his own trophies');
select throws_ok(
  $$insert into trophies (user_id, season, kind) values
    ('7a0f0000-0000-0000-0000-000000000004', 2031, 'witness')$$,
  '42501', null, 'a player cannot award himself a trophy');
select throws_ok($$select admin_replace_trophies(2031, '[]'::jsonb)$$, '42501', null,
  'a player cannot replace the trophies');
select throws_ok($$select admin_set_trophy_witness('Max Trophees')$$, '42501', null,
  'a player cannot designate the FrenchTrack account');
select throws_ok($$select * from trophy_settings$$, '42501', null,
  'a player cannot read the trophy settings');

select * from finish();
rollback;
