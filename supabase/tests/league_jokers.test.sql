-- pgTAP: the league jokers (#1090). A league receives the active jokers when it is created; each
-- joker is played once in the league, one per event, on a prediction added to the league (the spy
-- only needs the league to count the event), until the lock; the spy is spent once played. The
-- others see a joker once the event is locked.
-- Run with `supabase test db`. Everything is rolled back at the end.
begin;
select plan(22);

insert into auth.users (id, email) values
  ('eeee1090-0000-0000-0000-000000000001', 'anna@example.test'),
  ('eeee1090-0000-0000-0000-000000000002', 'bob@example.test'),
  ('eeee1090-0000-0000-0000-000000000003', 'cleo@example.test');
insert into profiles (id, pseudo, age_confirmed_at) values
  ('eeee1090-0000-0000-0000-000000000001', 'Anna', now()),
  ('eeee1090-0000-0000-0000-000000000002', 'Bob', now()),
  ('eeee1090-0000-0000-0000-000000000003', 'Cleo', now());

-- Three open events of the seed competition, Anna's and Bob's predictions on each.
insert into events (id, competition_id, slug, discipline, gender, starts_at, lock_at)
select v.id::uuid, c.id, v.slug, '100 m', 'F', now() + interval '1 day', now() + interval '1 hour'
from competitions c,
     (values ('eeee1090-0000-0000-0000-0000000000e1', 'test-jokers-1'),
             ('eeee1090-0000-0000-0000-0000000000e2', 'test-jokers-2'),
             ('eeee1090-0000-0000-0000-0000000000e3', 'test-jokers-3')) as v(id, slug)
where c.slug = 'ultimate-championship-2026';
insert into entries (event_id, athlete_id)
select e.id, x.athlete_id
from events e, entries x
where e.slug like 'test-jokers-%' and x.event_id = (select id from events where slug = 'f-100m');
insert into predictions (user_id, event_id, p1, p2, p3)
select u, e.id, a[1], a[2], a[3]
from events e,
     lateral (select array_agg(athlete_id order by athlete_id) a from entries where event_id = e.id) x,
     unnest(array['eeee1090-0000-0000-0000-000000000001',
                  'eeee1090-0000-0000-0000-000000000002']::uuid[]) u
where e.slug like 'test-jokers-%';

-- A league of Anna and Bob counting the competition; their predictions of e1 and e2 count in it.
insert into leagues (id, name, owner_id) values
  ('eeee1090-0000-0000-0000-0000000000a1', 'Amis', 'eeee1090-0000-0000-0000-000000000001');
insert into league_members (league_id, user_id)
select 'eeee1090-0000-0000-0000-0000000000a1', u
from unnest(array['eeee1090-0000-0000-0000-000000000001',
                  'eeee1090-0000-0000-0000-000000000002']::uuid[]) u;
insert into league_competitions (league_id, competition_id)
select 'eeee1090-0000-0000-0000-0000000000a1', c.id
from competitions c where c.slug = 'ultimate-championship-2026';
insert into league_predictions (league_id, user_id, event_id)
select 'eeee1090-0000-0000-0000-0000000000a1', p.user_id, p.event_id
from predictions p join events e on e.id = p.event_id
where e.slug in ('test-jokers-1', 'test-jokers-2');

create function act_as(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
create function anna_plays(p_event text, p_kind text) returns void language sql as $$
  select play_league_joker('eeee1090-0000-0000-0000-0000000000a1', ('eeee1090-0000-0000-0000-0000000000' || p_event)::uuid, p_kind)
$$;
create function joker_on(p_event text) returns text language sql as $$
  select kind from league_joker_plays
  where league_id = 'eeee1090-0000-0000-0000-0000000000a1'
    and user_id = 'eeee1090-0000-0000-0000-000000000001'
    and event_id = ('eeee1090-0000-0000-0000-0000000000' || p_event)::uuid
$$;
grant execute on function act_as(text), anna_plays(text, text), joker_on(text) to authenticated;

-- The catalogue and the snapshot of a league.
select is((select array_agg(kind order by position) from jokers where game = 'predictions'),
          array['double', 'all_or_nothing', 'safety_net', 'spy', 'outsider'],
          'the prediction leagues play five jokers');
select is((select count(*)::int from league_jokers where league_id = 'eeee1090-0000-0000-0000-0000000000a1'), 5,
          'a new league receives every active joker');
update jokers set active = false where game = 'predictions' and kind = 'outsider';
insert into leagues (id, name, owner_id) values
  ('eeee1090-0000-0000-0000-0000000000a2', 'Club', 'eeee1090-0000-0000-0000-000000000001');
select is((select count(*)::int from league_jokers where league_id = 'eeee1090-0000-0000-0000-0000000000a2'), 4,
          'a joker turned off is not given to a new league');
select is((select count(*)::int from league_jokers where league_id = 'eeee1090-0000-0000-0000-0000000000a1'), 5,
          'a league keeps the jokers it received');

set local role authenticated;
select act_as('eeee1090-0000-0000-0000-000000000001');

select throws_ok($$select set_joker_active('predictions', 'outsider', true)$$, '42501', null,
                 'only an admin turns a joker on or off');
select throws_ok(
  $$insert into league_joker_plays (league_id, user_id, event_id, kind)
    values ('eeee1090-0000-0000-0000-0000000000a1', 'eeee1090-0000-0000-0000-000000000001',
            'eeee1090-0000-0000-0000-0000000000e1', 'double')$$,
  '42501', null, 'a joker is played through play_league_joker only');

select lives_ok($$select anna_plays('e1', 'double')$$, 'a member plays a joker on a prediction of the league');
select throws_ok($$select anna_plays('e2', 'double')$$, 'FT045', null,
                 'R7: the same joker twice in a league is refused');
select lives_ok($$select anna_plays('e1', 'all_or_nothing')$$, 'another joker on the same event replaces it');
select is(joker_on('e1'), 'all_or_nothing', 'one joker per event and per league');
select lives_ok($$select anna_plays('e2', 'double')$$, 'the joker replaced is back in the hand');
select throws_ok($$select anna_plays('e3', 'safety_net')$$, 'FT047', null,
                 'a joker needs the prediction added to the league');
select lives_ok($$select anna_plays('e3', 'spy')$$, 'the spy only needs the league to count the event');
select throws_ok(
  $$select remove_league_joker('eeee1090-0000-0000-0000-0000000000a1', 'eeee1090-0000-0000-0000-0000000000e3')$$,
  'FT046', null, 'the spy is spent once played');
select ok(exists (select 1 from event_consensus('eeee1090-0000-0000-0000-0000000000e3',
                                                'eeee1090-0000-0000-0000-0000000000a1')),
          'the spy shows the trend of the league before the lock');

-- Bob sees nothing of Anna's jokers before the lock, and no trend without a spy.
select act_as('eeee1090-0000-0000-0000-000000000002');
select is((select count(*)::int from league_joker_plays
           where user_id = 'eeee1090-0000-0000-0000-000000000001'), 0,
          'the others do not see a joker before the lock');
select throws_ok(
  $$select * from event_consensus('eeee1090-0000-0000-0000-0000000000e2', 'eeee1090-0000-0000-0000-0000000000a1')$$,
  'FT033', null, 'no trend before the lock without the spy');

-- Cleo, not a member, plays nothing.
select act_as('eeee1090-0000-0000-0000-000000000003');
select throws_ok($$select anna_plays('e1', 'outsider')$$, '42501', null,
                 'a player outside the league plays nothing there');

-- The event locks: the joker is fixed and the members see it.
reset role;
update events set lock_at = now() - interval '1 minute', starts_at = now()
where id = 'eeee1090-0000-0000-0000-0000000000e1';
set local role authenticated;
select act_as('eeee1090-0000-0000-0000-000000000002');
select is((select kind from league_joker_plays
           where user_id = 'eeee1090-0000-0000-0000-000000000001'), 'all_or_nothing',
          'the members see the joker once the event is locked');
select act_as('eeee1090-0000-0000-0000-000000000001');
select throws_ok($$select anna_plays('e1', 'safety_net')$$, 'FT043', null,
                 'after the lock, the joker of the event is fixed');

-- Removing the prediction from the league gives its joker back.
select lives_ok(
  $$select set_prediction_leagues('eeee1090-0000-0000-0000-0000000000e2', '{}')$$,
  'the player removes a prediction from the league');
select is(joker_on('e2'), null, 'its joker goes back to the hand');

select * from finish();
rollback;
