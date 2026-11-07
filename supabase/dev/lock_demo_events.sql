-- Local testing only. Run through `npm run db:test-points`, right after the demo players.
-- Prints the athletes of the two events the demo players predicted, as a, b, c, then locks those
-- two events so the admin can enter their results. Enter a 1st, b 2nd, c 3rd to get the points
-- written at the top of demo_players.sql.
begin;

create temp table demo_events on commit drop as
select id, slug, row_number() over (order by starts_at, slug) as k
from events
where lock_at > now() + interval '1 minute'
order by starts_at, slug
limit 2;

select 'Épreuve ' || d.k || ' (' || d.slug || ')' as "épreuve",
       chr(96 + row_number() over (partition by d.k order by e.athlete_id)::int) as "lettre",
       a.name as "athlète"
from demo_events d
join entries e on e.event_id = d.id
join athletes a on a.id = e.athlete_id
order by d.k, e.athlete_id;

update events set lock_at = now() where id in (select id from demo_events);

commit;
