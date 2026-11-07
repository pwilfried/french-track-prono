-- Local testing only: never part of the migrations or of seed.sql.
--
-- Twelve invented players (demo-N@example.test) with predictions on the first two open events,
-- to check the points by hand. Run `npm run db:open-events` first. Running it again starts over.
--
-- The athletes of each event are called a, b, c in the order of their id (the order of the start
-- list in the app). If the admin enters the result a 1st, b 2nd, c 3rd on both events:
--
--   Event 1 (only Démo Gazelle picks a as winner: 1 player out of 12, so the flair applies)
--     Démo Gazelle   a b c + joker  -> (12 + flair 2) x 2 = 28, the maximum
--     the others     never a first  -> 0 to 3 points
--   Event 2 (a is a popular winner: no flair)
--     Démo Perche    a b c          -> 12, perfect podium
--     Démo Haie      a c b + joker  -> (3 + 1 + 1) x 2 = 10
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

create temp table demo (n int primary key, pseudo text, avatar text) on commit drop;
insert into demo values
  (1, 'Démo Gazelle', '🦌'), (2, 'Démo Perche', '🦅'), (3, 'Démo Haie', '🐆'),
  (4, 'Démo Relais', '🐎'), (5, 'Démo Marteau', '🦁'), (6, 'Démo Javelot', '🐺'),
  (7, 'Démo Sprint', '🐇'), (8, 'Démo Fond', '🐢'), (9, 'Démo Disque', '🦊'),
  (10, 'Démo Triple', '🐬'), (11, 'Démo Poids', '🐻'), (12, 'Démo Hauteur', '🦒');

insert into auth.users (id, email, aud, role)
select ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid,
       'demo-' || n || '@example.test', 'authenticated', 'authenticated'
from demo;

insert into profiles (id, pseudo, avatar_emoji, age_confirmed_at)
select ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid, pseudo, avatar, now()
from demo;

-- (player, event 1 or 2, order of a/b/c on the podium, joker)
with picks (n, k, podium, joker) as (values
  (1, 1, 'abc', true),  (2, 1, 'bac', false), (3, 1, 'cab', false), (4, 1, 'bca', false),
  (5, 1, 'cba', false), (6, 1, 'bac', false), (7, 1, 'cab', false), (8, 1, 'bca', false),
  (9, 1, 'cba', false), (10, 1, 'bac', false), (11, 1, 'cab', false), (12, 1, 'bca', false),
  (1, 2, 'bac', false), (2, 2, 'abc', false), (3, 2, 'acb', true),  (4, 2, 'bca', false),
  (5, 2, 'cba', false), (6, 2, 'abc', false), (7, 2, 'bac', false), (8, 2, 'acb', false),
  (9, 2, 'abc', false), (10, 2, 'cab', false), (11, 2, 'acb', false), (12, 2, 'abc', false)
),
open_events as (
  select id, row_number() over (order by starts_at, slug) as k
  from events
  where lock_at > now() + interval '1 minute'
),
athletes as (
  select event_id, array_agg(athlete_id order by athlete_id) as a from entries group by event_id
)
insert into predictions (user_id, event_id, p1, p2, p3, use_joker)
select ('00000000-0000-4000-9000-' || lpad(p.n::text, 12, '0'))::uuid, e.id,
       x.a[ascii(substr(p.podium, 1, 1)) - 96],
       x.a[ascii(substr(p.podium, 2, 1)) - 96],
       x.a[ascii(substr(p.podium, 3, 1)) - 96],
       p.joker
from picks p
join open_events e on e.k = p.k
join athletes x on x.event_id = e.id;

commit;
