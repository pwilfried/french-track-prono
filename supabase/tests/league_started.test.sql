-- pgTAP: a prediction league is closed to newcomers once the first event of one of its
-- competitions is locked (#780); the official league stays open to everyone.
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(13);

insert into auth.users (id, email) values
  ('57a70000-0000-0000-0000-000000000001', 'creator-started@example.test'),
  ('57a70000-0000-0000-0000-000000000002', 'early-started@example.test'),
  ('57a70000-0000-0000-0000-000000000003', 'late-started@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('57a70000-0000-0000-0000-000000000001', 'Fondatrice', now()),
  ('57a70000-0000-0000-0000-000000000002', 'Matinale', now()),
  ('57a70000-0000-0000-0000-000000000003', 'Tardive', now());

create temp table pub (league uuid, code text);
create temp table priv (league uuid, code text);
grant all on pub, priv to authenticated;

create function act_as(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- A coming competition with one event, locked in ten days.
with c as (
  insert into competitions (slug, name, starts_on, ends_on)
  values ('test-league-started', 'Test', current_date + 10, current_date + 11)
  returning id
)
insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
select id, 'test-league-started-100m', '100 m', 'F', now() + interval '10 days',
       now() + interval '10 days'
from c;

-- The official league, on the same competition (the migration may have made one: set it aside).
delete from leagues where is_official;
with l as (
  insert into leagues (name, owner_id, is_public, is_official)
  values ('Ligue FrenchTrack', '57a70000-0000-0000-0000-000000000001', true, true)
  returning id
), m as (
  insert into league_members (league_id, user_id, role)
  select id, '57a70000-0000-0000-0000-000000000001', 'owner' from l
)
insert into league_competitions (league_id, competition_id)
select l.id, c.id from l, competitions c where c.slug = 'test-league-started';

set local role authenticated;
select act_as('57a70000-0000-0000-0000-000000000001');
insert into pub select * from create_league('Les Matinaux', array['test-league-started'], true);
insert into priv select * from create_league('Entre amis', array['test-league-started']);

-- Before the first lock, anyone may come in.
select act_as('57a70000-0000-0000-0000-000000000002');
select is(league_invite_status((select code from priv)), 'open',
  'before the first lock, the invite page offers to join');
select is(join_league((select code from priv)), (select league from priv),
  'before the first lock, a player joins with the code');
select is(join_public_league((select league from pub)), (select league from pub),
  'before the first lock, a player joins a public league in one tap');

-- The event is locked: the leagues have started.
reset role;
update events set lock_at = now() - interval '1 minute', starts_at = now() - interval '1 minute'
where slug = 'test-league-started-100m';
set local role authenticated;

select act_as('57a70000-0000-0000-0000-000000000003');
select throws_ok($$ select join_league((select code from priv)) $$, 'FT032', null,
  'once the first event is locked, a newcomer cannot join with the code');
select throws_ok($$ select join_public_league((select league from pub)) $$, 'FT032', null,
  'once the first event is locked, a newcomer cannot join a public league');
select is(league_invite_status((select code from priv)), 'started',
  'the invite page of a started league says it has started');
select ok(not exists (select 1 from list_public_leagues() where league_id = (select league from pub)),
  'a started public league leaves the list of public leagues');
select is(league_invite_status('ZZZZZZ'), null, 'an unknown code has no status');

-- A member who joins again is simply taken to the league.
select act_as('57a70000-0000-0000-0000-000000000002');
select is(join_league((select code from priv)), (select league from priv),
  'a member who joins a started league again is taken to it');
select is(join_public_league((select league from pub)), (select league from pub),
  'a member who joins a started public league again is taken to it');
select is(league_invite_status((select code from priv)), 'member',
  'the invite page lets a member through to their league');

-- The official league stays open: everyone is in it.
select act_as('57a70000-0000-0000-0000-000000000003');
select ok(exists (select 1 from list_public_leagues() where is_official),
  'the official league stays in the list once its competition has started');
select lives_ok($$ select join_public_league((select league_id from list_public_leagues() where is_official)) $$,
  'a newcomer still joins the official league once its competition has started');

select * from finish();
rollback;
