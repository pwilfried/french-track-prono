-- Pre-production demo set (#694): loaded by preprod.yml after the migrations and the seed, at every
-- deploy (ci/preprod/load-sql.sh). Never in production, never read from production: everything
-- here is invented (athletes, players, leagues), the competitions only look like real ones.
--
--   * 6 competitions, « démo » in their name: one finished with results (Diamond League), one
--     under way (international championship: yesterday's events have results), four to come
--     (French championship, an indoor meeting, two Diamond League meetings);
--   * 60 athletes on 7 disciplines per sex, each with a personal best (pr) and a season best (sb);
--   * 20 players demo-1..20@example.test (no password: the owner never signs in as them), their
--     predictions and points on the finished events;
--   * 3 prediction leagues, and one complete Manager league: 4 players, mercato closed, teams,
--     matchdays drawn, lineups and scores of the first matchday, so the standings show.
--
-- Dates are relative to the day of the load (Paris time) and moved again at each load, so the
-- pre-production always has a finished, an ongoing and coming competitions.
-- Idempotent and kept: each row has a fixed key (slug, uuid) and is written only when missing; a
-- second load adds nothing and deletes nothing the owner created by hand. The only rows written
-- again are the demo ones that follow the day (dates) and the points of the demo players.
-- Checked twice in a row in CI on local Supabase (src/infra/preprod-demo.test.ts).
--
-- The prediction and lineup locks refuse a row once its competition has started: new events are
-- first written open (a year ahead), the demo predictions and lineups go in, then the events get
-- their real dates, all in this one transaction. A later load only adds what is still open.
begin;

-- Temporary tables and helpers of an earlier load in the same session (the CI check loads it twice
-- in one transaction; a pooled connection may be reused) are dropped first.
discard temp;

-- Fixed ids: players 00000000-0000-4000-9000-0000000000NN (as in supabase/dev), leagues below.
create temp table demo_players (n int primary key, pseudo text, bib_number smallint, bib_color text)
  on commit drop;
insert into demo_players values
  (1, 'Démo Gazelle', 7, 'blue'),    (2, 'Démo Perche', 42, 'red'),     (3, 'Démo Haie', 110, 'gold'),
  (4, 'Démo Relais', 4, 'green'),    (5, 'Démo Marteau', 85, 'white'),  (6, 'Démo Javelot', 98, 'night'),
  (7, 'Démo Sprint', 100, 'blue'),   (8, 'Démo Fond', 999, 'red'),      (9, 'Démo Disque', 0, 'gold'),
  (10, 'Démo Triple', 18, 'green'),  (11, 'Démo Poids', 23, 'white'),   (12, 'Démo Hauteur', 245, 'night'),
  (13, 'Démo Steeple', 300, 'blue'), (14, 'Démo Témoin', 14, 'red'),    (15, 'Démo Starter', 1, 'gold'),
  (16, 'Démo Chrono', 60, 'green'),  (17, 'Démo Foulée', 517, 'white'), (18, 'Démo Élan', 88, 'night'),
  (19, 'Démo Virage', 200, 'blue'),  (20, 'Démo Finish', 777, 'red');

-- The competitions: start day relative to today, number of days.
create temp table demo_competitions (
  k int primary key, slug text, name text, city text, country_code text, level text,
  scope text, venue text, start_offset int, days int, status event_status
) on commit drop;
insert into demo_competitions values
  (1, 'demo-meeting-rabat', 'Meeting démo de Rabat', 'Rabat', 'MAR', 'diamond-league',
   'international', 'outdoor', -10, 1, 'finished'),
  (2, 'demo-jeux-lisbonne', 'Championnats démo de Lisbonne', 'Lisbonne', 'POR', 'championnat',
   'international', 'outdoor', -1, 3, 'live'),
  (3, 'demo-france-elite', 'Championnats de France démo', 'Albi', 'FRA', 'championnat',
   'france', 'outdoor', 8, 2, 'upcoming'),
  (4, 'demo-salle-lievin', 'Meeting démo en salle de Liévin', 'Liévin', 'FRA',
   'world-indoor-tour-gold', 'international', 'indoor', 15, 1, 'upcoming'),
  (5, 'demo-meeting-zurich', 'Meeting démo de Zurich', 'Zurich', 'SUI', 'diamond-league',
   'international', 'outdoor', 22, 1, 'upcoming'),
  (6, 'demo-meeting-paris', 'Meeting démo de Paris', 'Paris', 'FRA', 'diamond-league',
   'international', 'outdoor', 29, 1, 'upcoming');

-- The disciplines of the set, per sex: the mark of the best athlete (r = 0) and the gap per rank
-- (positive for a time, negative for a distance), in seconds or metres.
create temp table demo_disciplines (
  gender char(1), key text, discipline text, family text, base numeric, step numeric,
  primary key (gender, key)
) on commit drop;
insert into demo_disciplines values
  ('F', '100m', '100 m', 'sprint', 10.86, 0.06),
  ('M', '100m', '100 m', 'sprint', 9.83, 0.05),
  ('F', 'hurdles', '100 m haies', 'hurdles', 12.32, 0.08),
  ('M', 'hurdles', '110 m haies', 'hurdles', 12.95, 0.07),
  ('F', '1500m', '1500 m', 'middle', 234.5, 1.5),
  ('M', '1500m', '1500 m', 'middle', 208.3, 1.2),
  ('F', '5000m', '5000 m', 'long', 864, 6),
  ('M', '5000m', '5000 m', 'long', 767, 5),
  ('F', 'long-jump', 'Saut en longueur', 'horizontal_jumps', 7.10, -0.08),
  ('M', 'long-jump', 'Saut en longueur', 'horizontal_jumps', 8.43, -0.08),
  ('F', 'pole-vault', 'Saut à la perche', 'vertical_jumps', 4.92, -0.07),
  ('M', 'pole-vault', 'Saut à la perche', 'vertical_jumps', 6.13, -0.08),
  ('F', 'javelin', 'Javelot', 'throws', 68.1, -1.6),
  ('M', 'javelin', 'Javelot', 'throws', 90.8, -1.8);

-- 60 invented athletes: r is their rank in their discipline, 1 the strongest.
create temp table demo_athletes (
  gender char(1), key text, r int, name text, country_code text, primary key (gender, key, r)
) on commit drop;
insert into demo_athletes values
  ('F', '100m', 1, 'Inès Varenne', 'FRA'),         ('F', '100m', 2, 'Talia Brookfield', 'USA'),
  ('F', '100m', 3, 'Amara Okonjo', 'NGR'),         ('F', '100m', 4, 'Shanice Delvaux', 'JAM'),
  ('F', '100m', 5, 'Lea Hartwig', 'GER'),
  ('M', '100m', 1, 'Kofi Mensano', 'GHA'),         ('M', '100m', 2, 'Jalen Whitcombe', 'USA'),
  ('M', '100m', 3, 'Rhys Calloway', 'GBR'),        ('M', '100m', 4, 'Mathis Ferrand', 'FRA'),
  ('M', '100m', 5, 'Andre Baptiste', 'JAM'),
  ('F', 'hurdles', 1, 'Noémie Castel', 'FRA'),     ('F', 'hurdles', 2, 'Danika Holloway', 'USA'),
  ('F', 'hurdles', 3, 'Ebru Aksoylu', 'TUR'),      ('F', 'hurdles', 4, 'Femke van Dalen', 'NED'),
  ('M', 'hurdles', 1, 'Orlando Quiñones', 'PUR'),  ('M', 'hurdles', 2, 'Tristan Vasseur', 'FRA'),
  ('M', 'hurdles', 3, 'Grant Ellery', 'USA'),      ('M', 'hurdles', 4, 'Hiroto Saeki', 'JPN'),
  ('F', '1500m', 1, 'Aster Wolde', 'ETH'),         ('F', '1500m', 2, 'Margaux Lenoir', 'FRA'),
  ('F', '1500m', 3, 'Siobhan Keane', 'IRL'),       ('F', '1500m', 4, 'Freya Lindqvist', 'SWE'),
  ('F', '1500m', 5, 'Halima Cheruto', 'KEN'),
  ('M', '1500m', 1, 'Elias Haugland', 'NOR'),      ('M', '1500m', 2, 'Bilal Rahmouni', 'MAR'),
  ('M', '1500m', 3, 'Samuel Kiprono', 'KEN'),      ('M', '1500m', 4, 'Hugo Tessier', 'FRA'),
  ('M', '1500m', 5, 'Callum Forsyth', 'GBR'),
  ('F', '5000m', 1, 'Lemlem Tadesse', 'ETH'),      ('F', '5000m', 2, 'Joyline Wambui', 'KEN'),
  ('F', '5000m', 3, 'Clémence Aubry', 'FRA'),      ('F', '5000m', 4, 'Ingrid Solberg', 'NOR'),
  ('M', '5000m', 1, 'Berihu Gidane', 'ETH'),       ('M', '5000m', 2, 'Paul Kimutai', 'KEN'),
  ('M', '5000m', 3, 'Yann Kerbrat', 'FRA'),        ('M', '5000m', 4, 'Diego Arriaga', 'ESP'),
  ('F', 'long-jump', 1, 'Camila Restrepo', 'COL'), ('F', 'long-jump', 2, 'Maëlle Doucet', 'FRA'),
  ('F', 'long-jump', 3, 'Ivana Petrović', 'SRB'),  ('F', 'long-jump', 4, 'Keisha Monroe', 'USA'),
  ('M', 'long-jump', 1, 'Thiago Moreira', 'BRA'),  ('M', 'long-jump', 2, 'Bastien Royer', 'FRA'),
  ('M', 'long-jump', 3, 'Nikos Andreadis', 'GRE'), ('M', 'long-jump', 4, 'Jordan Abernathy', 'USA'),
  ('F', 'pole-vault', 1, 'Solène Marchal', 'FRA'), ('F', 'pole-vault', 2, 'Katrin Vogel', 'GER'),
  ('F', 'pole-vault', 3, 'Ellie Harrington', 'GBR'), ('F', 'pole-vault', 4, 'Anna Kowalczyk', 'POL'),
  ('M', 'pole-vault', 1, 'Lars Fjeldstad', 'SWE'), ('M', 'pole-vault', 2, 'Anthony Moulin', 'FRA'),
  ('M', 'pole-vault', 3, 'Kurtis Beaumont', 'CAN'), ('M', 'pole-vault', 4, 'Piotr Wasiak', 'POL'),
  ('F', 'javelin', 1, 'Tereza Holubová', 'CZE'),   ('F', 'javelin', 2, 'Mio Tanabe', 'JPN'),
  ('F', 'javelin', 3, 'Oriane Picard', 'FRA'),     ('F', 'javelin', 4, 'Kelsey Ashford', 'AUS'),
  ('M', 'javelin', 1, 'Jonas Lehtonen', 'FIN'),    ('M', 'javelin', 2, 'Rohan Mehta', 'IND'),
  ('M', 'javelin', 3, 'Erwan Le Gall', 'FRA'),     ('M', 'javelin', 4, 'Kristaps Ozols', 'LAT');

-- The events: competition, sex, discipline, day of the competition (0 = first), Paris time.
create temp table demo_events (
  k int, gender char(1), key text, day int, at time, featured boolean,
  primary key (k, gender, key)
) on commit drop;
insert into demo_events values
  -- 1. Finished, ten days ago.
  (1, 'F', '100m', 0, '21:40', true),       (1, 'M', '100m', 0, '21:50', true),
  (1, 'F', 'hurdles', 0, '21:05', false),   (1, 'M', 'hurdles', 0, '21:20', false),
  (1, 'F', '1500m', 0, '20:30', false),     (1, 'M', '1500m', 0, '20:45', false),
  (1, 'F', 'long-jump', 0, '19:30', false), (1, 'M', 'long-jump', 0, '20:00', false),
  (1, 'F', 'pole-vault', 0, '19:00', false), (1, 'M', 'pole-vault', 0, '19:15', false),
  (1, 'F', 'javelin', 0, '20:10', false),   (1, 'M', 'javelin', 0, '20:15', false),
  -- 2. Under way: yesterday's events are finished, today's and tomorrow's to come.
  (2, 'F', '100m', 0, '21:30', true),       (2, 'M', '100m', 0, '21:45', true),
  (2, 'M', 'javelin', 0, '19:30', false),   (2, 'F', 'pole-vault', 0, '19:00', false),
  (2, 'F', '1500m', 1, '20:40', false),     (2, 'M', '1500m', 1, '21:00', false),
  (2, 'F', 'hurdles', 1, '21:20', false),   (2, 'M', 'hurdles', 1, '21:40', true),
  (2, 'F', '5000m', 2, '20:00', false),     (2, 'M', '5000m', 2, '20:30', true),
  (2, 'F', 'long-jump', 2, '19:00', false), (2, 'M', 'pole-vault', 2, '19:15', false),
  (2, 'F', 'javelin', 2, '19:30', false),   (2, 'M', 'long-jump', 2, '19:45', false),
  -- 3. French championship, in a week.
  (3, 'F', '100m', 0, '18:30', true),       (3, 'M', '100m', 0, '18:45', true),
  (3, 'F', '1500m', 0, '17:30', false),     (3, 'M', '1500m', 0, '17:50', false),
  (3, 'F', 'pole-vault', 0, '16:00', false), (3, 'M', 'javelin', 0, '16:30', false),
  (3, 'F', 'hurdles', 1, '17:00', false),   (3, 'M', 'hurdles', 1, '17:20', false),
  (3, 'F', 'long-jump', 1, '16:00', false), (3, 'M', 'pole-vault', 1, '16:15', true),
  -- 4. Indoor meeting.
  (4, 'F', '1500m', 0, '20:20', false),     (4, 'M', '1500m', 0, '20:40', true),
  (4, 'F', 'pole-vault', 0, '19:00', true), (4, 'M', 'pole-vault', 0, '19:10', false),
  (4, 'F', 'long-jump', 0, '19:40', false), (4, 'M', 'long-jump', 0, '19:50', false),
  -- 5. and 6. Diamond League meetings to come.
  (5, 'F', '100m', 0, '21:30', true),       (5, 'M', '100m', 0, '21:45', true),
  (5, 'F', 'hurdles', 0, '20:50', false),   (5, 'M', '5000m', 0, '20:10', false),
  (5, 'F', 'javelin', 0, '19:20', false),   (5, 'M', 'pole-vault', 0, '19:00', false),
  (5, 'F', '1500m', 0, '20:30', false),     (5, 'M', 'long-jump', 0, '19:40', false),
  (6, 'F', '100m', 0, '21:35', true),       (6, 'M', 'hurdles', 0, '21:15', true),
  (6, 'F', '5000m', 0, '20:20', false),     (6, 'M', '1500m', 0, '20:50', false),
  (6, 'F', 'pole-vault', 0, '19:10', false), (6, 'M', 'javelin', 0, '19:30', false),
  (6, 'F', 'long-jump', 0, '19:45', false), (6, 'M', '100m', 0, '21:50', false);

-- A mark as the app writes it: « 10.92 », « 3:56.00 », « 14:30.00 » (a time: positive step),
-- « 8.12 » or « 88.10 » (a distance).
create or replace function pg_temp.demo_mark(v numeric, step numeric) returns text
language sql immutable as $$
  select case when step > 0 and v >= 60
              then floor(v / 60)::int || ':' || to_char(round(v - 60 * floor(v / 60), 2), 'FM00.00')
              else to_char(round(v, 2), 'FM990.00') end
$$;

-- Today, Paris time: the day the whole set is placed around.
create or replace function pg_temp.demo_today() returns date language sql stable as $$
  select (now() at time zone 'Europe/Paris')::date
$$;

-- ---------- Competitions, athletes, events ----------
insert into competitions (slug, name, city, country_code, starts_on, ends_on, level, status, scope, venue)
select slug, name, city, country_code, pg_temp.demo_today() + start_offset,
       pg_temp.demo_today() + start_offset + days - 1, level, status, scope, venue
from demo_competitions
on conflict (slug) do nothing;

insert into athletes (slug, name, country_code, gender, manager_price)
select 'demo-' || lower(gender) || '-' || key || '-' || r, name, country_code, gender, 10 - r
from demo_athletes
on conflict (slug) do nothing;

create temp table demo_athlete_ids on commit drop as
select a.id, x.gender, x.key, x.r, d.discipline, d.family, d.base, d.step
from demo_athletes x
join demo_disciplines d using (gender, key)
join athletes a on a.slug = 'demo-' || lower(x.gender) || '-' || x.key || '-' || x.r;

insert into athlete_disciplines (athlete_id, discipline, is_primary)
select id, discipline, true from demo_athlete_ids
on conflict do nothing;

-- Personal best a few seasons ago, season best this year.
insert into athlete_records (athlete_id, discipline, kind, mark, mark_value, record_date, meeting_name)
select id, discipline, 'pr', pg_temp.demo_mark(base + step * r, step),
       parse_mark(pg_temp.demo_mark(base + step * r, step)),
       pg_temp.demo_today() - (400 + 90 * r), 'Meeting démo'
from demo_athlete_ids
on conflict do nothing;
insert into athlete_records (athlete_id, discipline, kind, mark, mark_value, record_date, meeting_name)
select id, discipline, 'sb', pg_temp.demo_mark(base + step * (r + 0.4), step),
       parse_mark(pg_temp.demo_mark(base + step * (r + 0.4), step)),
       greatest(date_trunc('year', pg_temp.demo_today())::date, pg_temp.demo_today() - (20 + 3 * r)),
       'Meeting démo'
from demo_athlete_ids
on conflict do nothing;

-- New events are written open (a year ahead), so that the demo predictions and lineups pass the
-- locks; their real dates come further down.
insert into events (competition_id, slug, discipline, gender, starts_at, lock_at, is_featured)
select c.id, k.slug || '-' || lower(e.gender) || '-' || e.key, d.discipline, e.gender,
       now() + interval '400 days', now() + interval '400 days', e.featured
from demo_events e
join demo_competitions k using (k)
join competitions c on c.slug = k.slug
join demo_disciplines d using (gender, key)
on conflict do nothing;

create temp table demo_event_ids on commit drop as
select ev.id, e.k, e.gender, e.key, ev.competition_id, ev.lock_at,
       -- Planned as finished: its day is before today.
       k.start_offset + e.day < 0 as past,
       row_number() over (partition by e.k order by e.day, e.at, e.gender, e.key) as ord,
       count(*) over (partition by e.k) as of_count
from demo_events e
join demo_competitions k using (k)
join competitions c on c.slug = k.slug
join events ev on ev.competition_id = c.id and ev.slug = k.slug || '-' || lower(e.gender) || '-' || e.key;

-- Start lists: every athlete of the discipline (the trigger fills competition_athletes).
insert into entries (event_id, athlete_id, season_best)
select e.id, a.id, pg_temp.demo_mark(a.base + a.step * (a.r + 0.4), a.step)
from demo_event_ids e
join demo_athlete_ids a using (gender, key)
on conflict do nothing;

-- ---------- Players and prediction leagues ----------
-- The columns GoTrue reads as non-null are all set (see supabase/dev/demo_state.sql).
insert into auth.users (
  instance_id, id, email, aud, role, email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  raw_app_meta_data, raw_user_meta_data
)
select '00000000-0000-0000-0000-000000000000'::uuid,
       ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid,
       'demo-' || n || '@example.test', 'authenticated', 'authenticated', now(), now(), now(),
       '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
from demo_players
on conflict (id) do nothing;

insert into profiles (id, pseudo, bib_number, bib_color, age_confirmed_at)
select ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid, pseudo, bib_number, bib_color, now()
from demo_players
on conflict (id) do nothing;

create temp table demo_player_ids on commit drop as
select n, ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid as id from demo_players;

-- Three leagues (fixed ids 00000000-0000-4000-9a00-00000000000N): owner, players, competitions,
-- families (none: every event counts).
create temp table demo_leagues (
  n int primary key, name text, emoji text, is_public boolean, owner int, players int[],
  competitions int[], families text[]
) on commit drop;
insert into demo_leagues values
  (1, 'Démo Les Sprinteurs', '🏃', true, 1, array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
   array[1, 2, 3, 5, 6], '{}'),
  (2, 'Démo Club du jeudi', '🍻', false, 3, array[2, 3, 5, 7, 9, 15, 16, 17], array[2, 3], '{}'),
  (3, 'Démo Sauts et lancers', '🎯', false, 10,
   array[10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], array[1, 2, 4], array['jumps', 'throws']);

insert into leagues (id, name, emoji, owner_id, is_public)
select ('00000000-0000-4000-9a00-' || lpad(n::text, 12, '0'))::uuid, name, emoji,
       ('00000000-0000-4000-9000-' || lpad(owner::text, 12, '0'))::uuid, is_public
from demo_leagues
on conflict (id) do nothing;

-- Joined a month ago: the finished events count in the league rankings.
insert into league_members (league_id, user_id, role, joined_at)
select ('00000000-0000-4000-9a00-' || lpad(l.n::text, 12, '0'))::uuid, p.id,
       case when p.n = l.owner then 'owner'::league_role else 'member'::league_role end,
       now() - interval '30 days'
from demo_leagues l
cross join lateral unnest(l.players) as u(n)
join demo_player_ids p on p.n = u.n
on conflict do nothing;

insert into league_competitions (league_id, competition_id)
select ('00000000-0000-4000-9a00-' || lpad(l.n::text, 12, '0'))::uuid, c.id
from demo_leagues l
cross join lateral unnest(l.competitions) as u(k)
join demo_competitions k on k.k = u.k
join competitions c on c.slug = k.slug
on conflict do nothing;

insert into league_families (league_id, family)
select ('00000000-0000-4000-9a00-' || lpad(l.n::text, 12, '0'))::uuid, f
from demo_leagues l
cross join lateral unnest(l.families) as f
on conflict do nothing;

-- ---------- Predictions ----------
-- Every player on competitions 1 and 2, players 1 to 12 on the 3rd, 1 to 6 on the 4th. The podium
-- letters a, b, c, d are the four strongest athletes of the start list; the pattern turns with the
-- player and the event. One joker per competition for the even players. Only open events: a later
-- load never writes on a locked one.
with patterns (i, p) as (
  select row_number() over () - 1, p from unnest(array[
    'abc', 'bac', 'acb', 'bca', 'cab', 'cba', 'abd', 'bad', 'adb', 'bda', 'dab', 'dba',
    'acd', 'cad', 'adc', 'cda', 'dac', 'dca', 'bcd', 'cbd', 'bdc', 'cdb', 'dbc', 'dcb']) as p
),
starts as (
  select e.id as event_id, array_agg(a.id order by a.r) as s
  from demo_event_ids e join demo_athlete_ids a using (gender, key)
  group by e.id
)
insert into predictions (user_id, event_id, p1, p2, p3, use_joker)
select pl.id, e.id,
       s.s[ascii(substr(pt.p, 1, 1)) - 96], s.s[ascii(substr(pt.p, 2, 1)) - 96],
       s.s[ascii(substr(pt.p, 3, 1)) - 96],
       pl.n % 2 = 0 and e.ord = pl.n % e.of_count + 1
from demo_player_ids pl
join demo_event_ids e on e.k = 1 or e.k = 2 or (e.k = 3 and pl.n <= 12) or (e.k = 4 and pl.n <= 6)
join starts s on s.event_id = e.id
join patterns pt on pt.i = (pl.n * 7 + e.ord * 5) % 24
where e.lock_at > now()
  and not exists (select 1 from predictions x where x.user_id = pl.id and x.event_id = e.id)
  and not (pl.n % 2 = 0 and e.ord = pl.n % e.of_count + 1
           and exists (select 1 from predictions x
                       where x.user_id = pl.id and x.competition_id = e.competition_id and x.use_joker));

-- ---------- Manager league (fixed id 00000000-0000-4000-9b00-000000000001) ----------
-- Four players (1, 4, 7, 11), mercato opened 3 weeks ago and closed 12 days ago, the 6 demo
-- competitions as season: 6 head-to-head matchdays, the first one played.
create temp table demo_managers (k int primary key, n int) on commit drop;
insert into demo_managers values (1, 1), (2, 4), (3, 7), (4, 11);

insert into manager_leagues (id, name, is_public, owner_id, rules, competition_ids, player_target,
                             mercato_starts_at, mercato_opened_at, mercato_closed_at)
select '00000000-0000-4000-9b00-000000000001', 'Démo Manager', true,
       '00000000-0000-4000-9000-000000000001', (select rules from manager_rules),
       (select array_agg(c.id order by k.k) from demo_competitions k join competitions c using (slug)),
       4, now() - interval '21 days', now() - interval '21 days', now() - interval '12 days'
on conflict (id) do nothing;

insert into manager_members (league_id, user_id, joined_at, team_compliant, revealed_round)
select '00000000-0000-4000-9b00-000000000001', p.id, now() - interval '25 days', true, 2
from demo_managers m join demo_player_ids p using (n)
on conflict do nothing;

insert into manager_rounds (league_id, round, ends_at, closed_at)
select '00000000-0000-4000-9b00-000000000001', r,
       now() - interval '21 days' + r * interval '48 hours',
       now() - interval '21 days' + r * interval '48 hours'
from generate_series(1, 2) r
on conflict do nothing;

-- Teams of 12, within the quotas and the budget of 100: per sex, one sprinter, hurdler, long jumper
-- (the k-th strongest for manager k) and one middle-distance, long-distance runner and thrower
-- (the k-th weakest), so each team costs 90. Vaulters and the 5th sprinters and milers stay free.
insert into manager_awards (league_id, athlete_id, user_id, amount, round)
select '00000000-0000-4000-9b00-000000000001', a.id, p.id, 10 - a.r, case when a.r <= 2 then 1 else 2 end
from demo_athlete_ids a
join demo_managers m on m.k = case when a.family in ('sprint', 'hurdles', 'horizontal_jumps') then a.r
                                   else 5 - a.r end
join demo_player_ids p on p.n = m.n
where a.family in ('sprint', 'hurdles', 'horizontal_jumps', 'middle', 'long', 'throws') and a.r <= 4
on conflict do nothing;

insert into manager_competitions (competition_id)
select c.id from demo_competitions k join competitions c using (slug) where k.k >= 3
on conflict do nothing;

-- Lineups of the 4 managers on the first two competitions, of two of them on the third: up to 8
-- athletes of their team entered in it, a sprinter, a miler and a thrower first. Only while open.
insert into manager_lineups (league_id, competition_id, user_id, athlete_ids)
select '00000000-0000-4000-9b00-000000000001', s.competition_id, s.user_id,
       (array_agg(s.athlete_id order by s.priority, s.athlete_id))[1:8]
from (
  select distinct c.id as competition_id, w.user_id, w.athlete_id,
         case a.family when 'sprint' then 1 when 'middle' then 2 when 'throws' then 3 else 4 end
           as priority, m.k as manager
  from demo_competitions k
  join competitions c using (slug)
  join competition_athletes ca on ca.competition_id = c.id
  join manager_awards w on w.athlete_id = ca.athlete_id
                       and w.league_id = '00000000-0000-4000-9b00-000000000001'
  join demo_athlete_ids a on a.id = w.athlete_id
  join demo_player_ids p on p.id = w.user_id
  join demo_managers m on m.n = p.n
  where k.k in (1, 2) or (k.k = 3 and m.k <= 2)
) s
where private.manager_lineup_lock(s.competition_id) > now()
  and not exists (select 1 from manager_lineups l
                  where l.league_id = '00000000-0000-4000-9b00-000000000001'
                    and l.competition_id = s.competition_id and l.user_id = s.user_id)
group by s.competition_id, s.user_id;

-- ---------- Dates of the day ----------
-- Every load moves the demo competitions, events and Manager league to their place around today.
update competitions c
set starts_on = pg_temp.demo_today() + k.start_offset,
    ends_on = pg_temp.demo_today() + k.start_offset + k.days - 1,
    status = k.status
from demo_competitions k
where c.slug = k.slug;

update events ev
set starts_at = ((pg_temp.demo_today() + k.start_offset + e.day) + e.at) at time zone 'Europe/Paris',
    lock_at = ((pg_temp.demo_today() + k.start_offset + e.day) + e.at) at time zone 'Europe/Paris'
              - interval '5 minutes'
from demo_events e
join demo_competitions k using (k)
join competitions c on c.slug = k.slug
where ev.competition_id = c.id and ev.slug = k.slug || '-' || lower(e.gender) || '-' || e.key;

update manager_leagues
set mercato_starts_at = now() - interval '21 days', mercato_opened_at = now() - interval '21 days',
    mercato_closed_at = now() - interval '12 days'
where id = '00000000-0000-4000-9b00-000000000001';

update manager_rounds
set ends_at = now() - interval '21 days' + round * interval '48 hours',
    closed_at = now() - interval '21 days' + round * interval '48 hours'
where league_id = '00000000-0000-4000-9b00-000000000001';

update league_members
set joined_at = now() - interval '30 days'
where league_id in (select ('00000000-0000-4000-9a00-' || lpad(n::text, 12, '0'))::uuid from demo_leagues)
  and user_id in (select id from demo_player_ids);

update manager_members
set joined_at = now() - interval '25 days'
where league_id = '00000000-0000-4000-9b00-000000000001';

-- The season: drawn once, in a reproducible order, now that the competitions have their dates.
do $$
begin
  perform setseed(0.694);
  perform private.schedule_manager_season('00000000-0000-4000-9b00-000000000001');
end $$;

-- ---------- Results of the finished events ----------
-- The order of arrival shuffles the start list a little, the marks follow the places: an athlete
-- ahead of their rank sets a season or personal best, which the triggers write (event finished too).
create temp table demo_places on commit drop as
select e.id as event_id, a.id as athlete_id, a.base, a.step,
       row_number() over (partition by e.id
                          order by a.r + (abs(hashtext(e.id::text)) + a.r * a.r) % 3, a.r) as place
from demo_event_ids e
join demo_athlete_ids a using (gender, key)
where e.past;

insert into results (event_id, athlete_id, rank, mark)
select event_id, athlete_id, place, pg_temp.demo_mark(base + step * (place + 0.5), step)
from demo_places p
where not exists (select 1 from results r where r.event_id = p.event_id);

insert into event_performances (event_id, athlete_id, status, place, mark)
select r.event_id, r.athlete_id, 'ok', r.rank, r.mark
from results r
join demo_event_ids e on e.id = r.event_id
on conflict do nothing;

-- ---------- Points of the demo players ----------
-- The rules of src/domain/scoring.ts with the scoring_rules of the database: exact place, on the
-- podium at another place, perfect podium, flair (winner found by less than 15 % of at least 10
-- players), joker. Written again at each load, for the demo players only.
create temp table demo_scores on commit drop as
with rules as (
  select max(value) filter (where key = 'exact_slot') as exact_slot,
         max(value) filter (where key = 'wrong_place') as wrong_place,
         max(value) filter (where key = 'perfect_podium') as perfect_podium,
         max(value) filter (where key = 'flair_bonus') as flair_bonus,
         max(value) filter (where key = 'flair_threshold') as flair_threshold,
         max(value) filter (where key = 'flair_min_players') as flair_min_players,
         max(value) filter (where key = 'joker_multiplier') as joker_multiplier
  from scoring_rules
),
podium as (
  select r.event_id,
         max(r.athlete_id::text) filter (where r.rank = 1)::uuid as r1,
         max(r.athlete_id::text) filter (where r.rank = 2)::uuid as r2,
         max(r.athlete_id::text) filter (where r.rank = 3)::uuid as r3
  from results r join demo_event_ids e on e.id = r.event_id
  group by r.event_id
),
field as (
  select pr.event_id, count(*) as players,
         count(*) filter (where pr.p1 = po.r1) as winner_picks
  from predictions pr join podium po using (event_id)
  group by pr.event_id
),
slots as (
  select pr.user_id, pr.event_id, pr.competition_id, pr.use_joker, f.players, f.winner_picks,
         pr.p1 = po.r1 as e1, pr.p2 = po.r2 as e2, pr.p3 = po.r3 as e3,
         coalesce(pr.p1 in (po.r2, po.r3), false) as o1,
         coalesce(pr.p2 in (po.r1, po.r3), false) as o2,
         coalesce(pr.p3 in (po.r1, po.r2), false) as o3
  from predictions pr
  join podium po using (event_id)
  join field f using (event_id)
  where pr.user_id in (select id from demo_player_ids)
),
counted as (
  select s.*, (s.e1::int + s.e2::int + s.e3::int) = 3 as perfect,
         s.e1 and s.players >= ru.flair_min_players
           and s.winner_picks::numeric / s.players < ru.flair_threshold as flair,
         (s.e1::int + s.e2::int + s.e3::int) * ru.exact_slot
           + (s.o1::int + s.o2::int + s.o3::int) * ru.wrong_place as base_points
  from slots s, rules ru
)
select c.user_id, c.event_id, c.competition_id,
       ((c.base_points + case when c.perfect then ru.perfect_podium else 0 end
                       + case when c.flair then ru.flair_bonus else 0 end)
        * case when c.use_joker then ru.joker_multiplier else 1 end)::int as points,
       jsonb_build_object('reasons',
         (case when c.e1 then '[{"kind":"exact","slot":1}]' when c.o1 then '[{"kind":"on_podium","slot":1}]' else '[]' end)::jsonb
      || (case when c.e2 then '[{"kind":"exact","slot":2}]' when c.o2 then '[{"kind":"on_podium","slot":2}]' else '[]' end)::jsonb
      || (case when c.e3 then '[{"kind":"exact","slot":3}]' when c.o3 then '[{"kind":"on_podium","slot":3}]' else '[]' end)::jsonb
      || (case when c.perfect then '[{"kind":"perfect_podium"}]' else '[]' end)::jsonb
      || (case when c.flair then '[{"kind":"flair"}]' else '[]' end)::jsonb
      || (case when c.use_joker then '[{"kind":"joker"}]' else '[]' end)::jsonb) as detail
from counted c, rules ru;

delete from score_events s
using demo_event_ids e
where s.event_id = e.id and s.source = 'prediction' and s.user_id in (select id from demo_player_ids);

insert into score_events (user_id, event_id, competition_id, source, points, reason, detail)
select user_id, event_id, competition_id, 'prediction', points, 'prediction', detail
from demo_scores;

update predictions pr
set points_awarded = s.points
from demo_scores s
where pr.user_id = s.user_id and pr.event_id = s.event_id;

-- ---------- Manager scores of the first matchday ----------
-- Each lined-up athlete: about 1200 World Athletics points, less by place, and the podium bonuses
-- of the league's rules; plus the manager's prediction points on the competition.
insert into manager_scores (league_id, competition_id, user_id, lined_up, total, hungarian, bonus,
                            predictions, athletes)
select l.league_id, l.competition_id, l.user_id, true,
       sum(x.points) + sum(x.bonus_points) + coalesce(pp.points, 0),
       sum(x.points), sum(x.bonus_points), coalesce(pp.points, 0),
       jsonb_agg(jsonb_build_object(
         'athlete_id', x.athlete_id, 'discipline', x.discipline, 'mark', x.mark, 'status', 'ok',
         'points', x.points, 'bonuses', x.bonuses, 'bonus_points', x.bonus_points,
         'total', x.points + x.bonus_points) order by x.points + x.bonus_points desc, x.athlete_id)
from manager_lineups l
join demo_competitions k on k.k = 1
join competitions c on c.slug = k.slug and c.id = l.competition_id
cross join lateral (
  select r.athlete_id, ev.discipline, r.mark, 1220 - 35 * r.rank as points,
         coalesce((ml.rules -> 'bonuses' ->> b.bonus)::int, 0) * (b.bonus is not null)::int
           as bonus_points,
         case when b.bonus is null then '[]'::jsonb
              else jsonb_build_array(jsonb_build_object(
                'bonus', b.bonus, 'points', (ml.rules -> 'bonuses' ->> b.bonus)::int)) end as bonuses
  from results r
  join events ev on ev.id = r.event_id and ev.competition_id = l.competition_id
  join manager_leagues ml on ml.id = l.league_id
  left join lateral (select case r.rank when 1 then 'first' when 2 then 'second'
                                        when 3 then 'third' end as bonus) b on true
  where r.athlete_id = any(l.athlete_ids)
) x
left join lateral (
  select sum(points)::int as points from score_events s
  where s.user_id = l.user_id and s.competition_id = l.competition_id
) pp on true
where l.league_id = '00000000-0000-4000-9b00-000000000001'
group by l.league_id, l.competition_id, l.user_id, pp.points
on conflict do nothing;

commit;
