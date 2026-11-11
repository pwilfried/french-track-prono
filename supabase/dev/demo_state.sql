-- Local testing only: never part of the migrations or of seed.sql.
--
-- One command to reach a lively app state after `supabase db reset`:
--   * the Ultimate Championship's events are split in half, past (finished, with results) and
--     future (upcoming, open for predictions);
--   * twelve demo players (demo-1..12@example.test, Démo Gazelle…Démo Hauteur) have predictions on
--     both halves;
--   * the past half earned them realistic points (mix of exact hits, podium misses, zeroes),
--     written in score_events and predictions.points_awarded so the leaderboard, the profile
--     stats and the badge grid all light up;
--   * one demo prono league ("Démo Prono", owned by Démo Gazelle, covering the championship)
--     gathers the twelve players;
--   * one demo Manager league ("Démo Manager", owned by Démo Gazelle, mercato open) gathers four
--     of them so the Manager flow has a visible state too.
-- Idempotent: run it again and the state is reset (users dropped, league recreated).
--
-- Demo users sign in by magic link: enter their email on /connexion and click the link in Mailpit
-- (http://127.0.0.1:54324). The script sets email_confirmed_at so the first request works right
-- away. Never ship this file; never copy it into production.
begin;

-- The enforce_prediction_lock trigger rejects predictions on events whose lock_at has passed;
-- demo predictions include the finished half, so temporarily switch the session to replica mode,
-- which skips user triggers. Restored at commit.
set local session_replication_role = 'replica';

-- 1. Shift the whole championship so it straddles "now": the first event starts 24 h ago and the
-- last one lands a day or two ahead, giving a mix of finished and upcoming events.
with first_start as (
  select min(starts_at) as t
  from events
  where competition_id = (select id from competitions where slug = 'ultimate-championship-2026')
),
shift as (
  select (date_trunc('minute', now()) - interval '24 hours') - t as by from first_start
)
update events e
set starts_at = e.starts_at + shift.by,
    lock_at   = e.starts_at + shift.by - interval '5 minutes',
    status    = case when e.starts_at + shift.by < now() then 'finished'::event_status
                     else 'upcoming'::event_status end
from shift
where e.competition_id = (select id from competitions where slug = 'ultimate-championship-2026');
-- Past events keep the seeded results. Future events had none (seed had results on all events,
-- but the shift above moved them: results stay joined by event_id, they just now belong to events
-- that are past). Clear results on events that ended up in the future so the podium is not spoilt.
delete from results r
using events e
where r.event_id = e.id
  and e.competition_id = (select id from competitions where slug = 'ultimate-championship-2026')
  and e.status = 'upcoming';

-- 2. Twelve demo users, with a password so they can sign in: demo-N@example.test / demo.
-- Explicit wipe by the fixed demo id range so a rerun starts over.
delete from score_events    where user_id::text like '00000000-0000-4000-9000-%';
delete from predictions     where user_id::text like '00000000-0000-4000-9000-%';
delete from league_members  where user_id::text like '00000000-0000-4000-9000-%';
delete from manager_members where user_id::text like '00000000-0000-4000-9000-%';
delete from profiles        where id::text      like '00000000-0000-4000-9000-%';
delete from auth.users      where email like 'demo-%@example.test';
-- The leagues the demo owns too, to clear old versions.
delete from leagues         where name in ('Démo Prono', 'Démo Manager');
delete from manager_leagues where name in ('Démo Prono', 'Démo Manager');
-- Avatars must be in src/domain/profile.ts AVATARS; anything else makes the Supabase profile
-- repository return null and the proxy sends the player to /bienvenue on every page.
create temp table demo (n int primary key, pseudo text, avatar text) on commit drop;
insert into demo values
  (1, 'Démo Gazelle', '🏃'), (2, 'Démo Perche', '🦅'), (3, 'Démo Haie', '🐆'),
  (4, 'Démo Relais', '⚡'),  (5, 'Démo Marteau', '🔥'), (6, 'Démo Javelot', '🚀'),
  (7, 'Démo Sprint', '🎯'),  (8, 'Démo Fond', '🐢'),   (9, 'Démo Disque', '🦊'),
  (10, 'Démo Triple', '🍀'), (11, 'Démo Poids', '🥇'), (12, 'Démo Hauteur', '🏅');

-- GoTrue (Supabase Auth) scans rows with Go structs that reject NULL on several columns the
-- schema still allows NULL on: instance_id, created_at, updated_at, and the token columns. Set
-- them all so the user can request a magic link.
insert into auth.users (
  instance_id, id, email, aud, role, email_confirmed_at,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  raw_app_meta_data, raw_user_meta_data
)
select '00000000-0000-0000-0000-000000000000'::uuid,
       ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid,
       'demo-' || n || '@example.test', 'authenticated', 'authenticated', now(),
       now(), now(),
       '', '', '', '',
       '{"provider":"email","providers":["email"]}'::jsonb,
       '{}'::jsonb
from demo;

insert into profiles (id, pseudo, avatar_emoji, age_confirmed_at)
select ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid, pseudo, avatar, now()
from demo;

-- 3. Predictions on every event of the championship: each player picks one of twelve podium
-- patterns, deterministic so the leaderboard is reproducible. One joker per player, on the first
-- event of their list. The podium letters a/b/c name the first three athletes of the start list
-- (by athlete_id).
create temp table podium_patterns (k int, pattern text) on commit drop;
insert into podium_patterns values
  (1, 'abc'), (2, 'bac'), (3, 'cab'), (4, 'bca'), (5, 'cba'), (6, 'bac'),
  (7, 'cab'), (8, 'bca'), (9, 'cba'), (10, 'bac'), (11, 'cab'), (12, 'bca');

insert into predictions (user_id, event_id, competition_id, p1, p2, p3, use_joker)
select ('00000000-0000-4000-9000-' || lpad(d.n::text, 12, '0'))::uuid,
       e.id, e.competition_id,
       x.a[ascii(substr(p.pattern, 1, 1)) - 96],
       x.a[ascii(substr(p.pattern, 2, 1)) - 96],
       x.a[ascii(substr(p.pattern, 3, 1)) - 96],
       -- Joker on the first event of the championship (earliest starts_at).
       e.id = (select id from events
               where competition_id = e.competition_id
               order by starts_at, slug limit 1)
from demo d
join podium_patterns p on p.k = d.n
join events e on e.competition_id = (select id from competitions where slug = 'ultimate-championship-2026')
join (select event_id, array_agg(athlete_id order by athlete_id) as a from entries group by event_id) x
     on x.event_id = e.id
where cardinality(x.a) >= 3;

-- 4. Points for the finished half: the exact podium (pattern 'abc', only player 1 picks it) earns
-- 12 points (3 exact + perfect podium bonus, modeled with the simple rules of the domain). Every
-- other pattern earns 0..6 depending on how many places are right; the formula below approximates
-- the scoring domain so numbers look believable without replaying it.
with ranked as (
  -- One row per (event, rank): a tie at rank 3 would otherwise duplicate predictions.
  select distinct on (event_id, rank) event_id, rank, athlete_id
  from results
  order by event_id, rank, athlete_id
),
per_pred as (
  select pr.user_id, pr.event_id, pr.competition_id, pr.use_joker,
         case when pr.p1 = r1.athlete_id then 1 else 0 end
       + case when pr.p2 = r2.athlete_id then 1 else 0 end
       + case when pr.p3 = r3.athlete_id then 1 else 0 end as exact,
         case when pr.p1 in (r1.athlete_id, r2.athlete_id, r3.athlete_id) and pr.p1 <> r1.athlete_id then 1 else 0 end
       + case when pr.p2 in (r1.athlete_id, r2.athlete_id, r3.athlete_id) and pr.p2 <> r2.athlete_id then 1 else 0 end
       + case when pr.p3 in (r1.athlete_id, r2.athlete_id, r3.athlete_id) and pr.p3 <> r3.athlete_id then 1 else 0 end as wrong_place
  from predictions pr
  join events e on e.id = pr.event_id and e.status = 'finished'
  left join ranked r1 on r1.event_id = pr.event_id and r1.rank = 1
  left join ranked r2 on r2.event_id = pr.event_id and r2.rank = 2
  left join ranked r3 on r3.event_id = pr.event_id and r3.rank = 3
),
scored as (
  select user_id, event_id, competition_id,
         (exact * 3 + wrong_place + case when exact = 3 then 4 else 0 end)
         * case when use_joker then 2 else 1 end as points,
         exact, wrong_place
  from per_pred
)
insert into score_events (user_id, event_id, competition_id, source, points, reason, detail)
select user_id, event_id, competition_id, 'prediction', points,
       case when exact = 3 then 'perfect_podium'
            when exact >= 1 then 'podium_hit'
            else 'podium_miss' end,
       jsonb_build_object('exact', exact, 'wrong_place', wrong_place)
from scored
where points > 0;

-- Keep predictions.points_awarded in step: the points-per-prediction come from the same query.
update predictions pr set points_awarded = s.points
from (
  with ranked as (
    select distinct on (event_id, rank) event_id, rank, athlete_id
    from results
    order by event_id, rank, athlete_id
  )
  select pr.user_id, pr.event_id,
         (case when pr.p1 = r1.athlete_id then 1 else 0 end
        + case when pr.p2 = r2.athlete_id then 1 else 0 end
        + case when pr.p3 = r3.athlete_id then 1 else 0 end) * 3
       + case when pr.p1 in (r1.athlete_id, r2.athlete_id, r3.athlete_id) and pr.p1 <> r1.athlete_id then 1 else 0 end
       + case when pr.p2 in (r1.athlete_id, r2.athlete_id, r3.athlete_id) and pr.p2 <> r2.athlete_id then 1 else 0 end
       + case when pr.p3 in (r1.athlete_id, r2.athlete_id, r3.athlete_id) and pr.p3 <> r3.athlete_id then 1 else 0 end
       + case when (case when pr.p1 = r1.athlete_id then 1 else 0 end
                  + case when pr.p2 = r2.athlete_id then 1 else 0 end
                  + case when pr.p3 = r3.athlete_id then 1 else 0 end) = 3 then 4 else 0 end
         as raw_points,
         pr.use_joker
  from predictions pr
  join events e on e.id = pr.event_id and e.status = 'finished'
  left join ranked r1 on r1.event_id = pr.event_id and r1.rank = 1
  left join ranked r2 on r2.event_id = pr.event_id and r2.rank = 2
  left join ranked r3 on r3.event_id = pr.event_id and r3.rank = 3
) s (user_id, event_id, points, use_joker)
where pr.user_id = s.user_id and pr.event_id = s.event_id
  and s.points > 0;

update predictions
set points_awarded = points_awarded * 2
where use_joker and points_awarded is not null;

-- 5. One demo prono league, twelve members, Démo Gazelle owns it, covers the Ultimate Championship.
with league as (
  insert into leagues (name, emoji, owner_id, is_public)
  values ('Démo Prono', '🎯',
          '00000000-0000-4000-9000-000000000001', true)
  returning id
)
insert into league_members (league_id, user_id, role)
select l.id, ('00000000-0000-4000-9000-' || lpad(d.n::text, 12, '0'))::uuid,
       case when d.n = 1 then 'owner'::league_role else 'member'::league_role end
from league l, demo d;

insert into league_competitions (league_id, competition_id)
select l.id, c.id
from leagues l, competitions c
where l.name = 'Démo Prono' and c.slug = 'ultimate-championship-2026';

-- 6. One demo Manager league, four members, Démo Gazelle owns it. Mercato open so bids make sense
-- in #422+. The rules are the default seeded set (budget 100, 14 quotas, saison 2027).
insert into manager_leagues (name, owner_id, is_public, rules, competition_ids, mercato_opened_at)
select 'Démo Manager',
       '00000000-0000-4000-9000-000000000001',
       true,
       (select rules from manager_rules where id),
       array[(select id from competitions where slug = 'ultimate-championship-2026')],
       now()
on conflict do nothing;

insert into manager_members (league_id, user_id)
select l.id,
       ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid
from manager_leagues l, unnest(array[1, 2, 3, 4]) as n
where l.name = 'Démo Manager'
on conflict do nothing;

-- Prime the Manager catalogue so the mercato page is not empty: give a reference price to a
-- handful of athletes already in the seed.
update athletes set manager_price = 20 where slug = 'mondo-duplantis';
update athletes set manager_price = 18 where slug = 'jakob-ingebrigtsen';
update athletes set manager_price = 15 where slug = 'melissa-jefferson-wooden';
update athletes set manager_price = 14 where slug = 'karsten-warholm';
update athletes set manager_price = 12 where slug = 'yaroslava-mahuchikh';
update athletes set manager_price = 10 where slug = 'haruka-kitaguchi';
update athletes set manager_price = 8  where slug = 'mykhaylo-kokhan';
update athletes set manager_price = 7  where slug = 'nikki-hiltz';

commit;
