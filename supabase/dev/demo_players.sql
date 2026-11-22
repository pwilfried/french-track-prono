-- Local testing only: never part of the migrations or of seed.sql.
--
-- Twelve invented players (demo-N@example.test) with predictions on the first two open events,
-- to check the points by hand. Run `npm run db:open-events` first. Running it again starts over.
--
-- The athletes of each event are called a, b, c in the order of their id (the order of the start
-- list in the app). If the admin enters the result a 1st, b 2nd, c 3rd on both events:
--
--   Event 1 (only Démo Gazelle picks a as winner: 1 player out of 12, so the flair applies)
--     Démo Gazelle   a b c          -> 12 + flair 2 = 14, the maximum
--     the others     never a first  -> 0 to 3 points
--   Event 2 (a is a popular winner: no flair)
--     Démo Perche    a b c          -> 12, perfect podium
--     Démo Haie      a c b          -> 3 + 1 + 1 = 5
--     Démo Relais    b c a          -> 3, all three misplaced
--     Démo Marteau   c b a          -> 5, 2nd found and two misplaced
begin;

do $$
begin
  if (select count(*) from events where lock_at > now() + interval '1 minute') < 2 then
    raise exception 'needs two open events: run npm run db:open-events first';
  end if;
end $$;

-- Start over: removing the users removes their profiles and predictions.
delete from auth.users where email like 'demo-%@example.test';

create temp table demo (n int primary key, pseudo text, bib_number smallint, bib_color text)
  on commit drop;
insert into demo values
  (1, 'Démo Gazelle', 7, 'blue'),   (2, 'Démo Perche', 42, 'red'),    (3, 'Démo Haie', 110, 'gold'),
  (4, 'Démo Relais', 4, 'green'),   (5, 'Démo Marteau', 85, 'white'), (6, 'Démo Javelot', 98, 'night'),
  (7, 'Démo Sprint', 100, 'blue'),  (8, 'Démo Fond', 999, 'red'),    (9, 'Démo Disque', 0, 'gold'),
  (10, 'Démo Triple', 18, 'green'), (11, 'Démo Poids', 23, 'white'), (12, 'Démo Hauteur', 245, 'night');

insert into auth.users (id, email, aud, role)
select ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid,
       'demo-' || n || '@example.test', 'authenticated', 'authenticated'
from demo;

insert into profiles (id, pseudo, bib_number, bib_color, age_confirmed_at)
select ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid, pseudo, bib_number, bib_color,
       now()
from demo;

-- (player, event 1 or 2, order of a/b/c on the podium)
with picks (n, k, podium) as (values
  (1, 1, 'abc'),  (2, 1, 'bac'), (3, 1, 'cab'), (4, 1, 'bca'),
  (5, 1, 'cba'), (6, 1, 'bac'), (7, 1, 'cab'), (8, 1, 'bca'),
  (9, 1, 'cba'), (10, 1, 'bac'), (11, 1, 'cab'), (12, 1, 'bca'),
  (1, 2, 'bac'), (2, 2, 'abc'), (3, 2, 'acb'),  (4, 2, 'bca'),
  (5, 2, 'cba'), (6, 2, 'abc'), (7, 2, 'bac'), (8, 2, 'acb'),
  (9, 2, 'abc'), (10, 2, 'cab'), (11, 2, 'acb'), (12, 2, 'abc')
),
open_events as (
  select id, row_number() over (order by starts_at, slug) as k
  from events
  where lock_at > now() + interval '1 minute'
),
athletes as (
  select event_id, array_agg(athlete_id order by athlete_id) as a from entries group by event_id
)
insert into predictions (user_id, event_id, p1, p2, p3)
select ('00000000-0000-4000-9000-' || lpad(p.n::text, 12, '0'))::uuid, e.id,
       x.a[ascii(substr(p.podium, 1, 1)) - 96],
       x.a[ascii(substr(p.podium, 2, 1)) - 96],
       x.a[ascii(substr(p.podium, 3, 1)) - 96]
from picks p
join open_events e on e.k = p.k
join athletes x on x.event_id = e.id;

commit;
