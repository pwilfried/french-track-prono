-- pgTAP: « Pronos oubliés » for the competitions a player's leagues count (#1151).
begin;
select plan(4);

-- The clock of the test: the next 18:00 in Paris (outside the default quiet hours), as in
-- reminders.test.sql.
create temp table clock as
  select case when t >= now() then t else t + interval '1 day' end as t0
  from (select (date_trunc('day', now() at time zone 'Europe/Paris') + interval '18 hours')
                 at time zone 'Europe/Paris' as t) x;

-- One final with a start list, locking at 18:10, starting at 20:00.
create temp table final as
  select e.id, e.slug, e.competition_id from events e
  where e.round = 'final' and (select count(*) from entries x where x.event_id = e.id) >= 3
  order by e.slug limit 1;
update competitions set odds_enabled = false where id = (select competition_id from final);
update events set status = 'upcoming',
  starts_at = (select t0 from clock) + interval '2 hours',
  lock_at = (select t0 from clock) + interval '10 minutes'
where id = (select id from final);

-- L is in a league counting the competition, M in a league counting another one, N in no league.
-- None of them has a prediction in the competition; all have a device and the default settings.
insert into auth.users (id, email)
select ('acac0000-0000-0000-0000-00000000000' || c)::uuid, 'league-remind-' || c || '@example.test'
from unnest(array['1', '2', '3']) c;
insert into profiles (id, pseudo, age_confirmed_at)
select ('acac0000-0000-0000-0000-00000000000' || c)::uuid, 'RappelLigue' || c, now()
from unnest(array['1', '2', '3']) c;
insert into push_subscriptions (endpoint, user_id, p256dh, auth)
select 'https://push.example.test/league-remind-' || c,
  ('acac0000-0000-0000-0000-00000000000' || c)::uuid, 'key', 'auth'
from unnest(array['1', '2', '3']) c;
insert into leagues (id, name, owner_id) values
  ('acac1000-0000-0000-0000-000000000001', 'Ligue rappel', 'acac0000-0000-0000-0000-000000000001'),
  ('acac1000-0000-0000-0000-000000000002', 'Ligue ailleurs', 'acac0000-0000-0000-0000-000000000002');
insert into league_members (league_id, user_id) values
  ('acac1000-0000-0000-0000-000000000001', 'acac0000-0000-0000-0000-000000000001'),
  ('acac1000-0000-0000-0000-000000000002', 'acac0000-0000-0000-0000-000000000002');
insert into league_competitions (league_id, competition_id)
select 'acac1000-0000-0000-0000-000000000001', competition_id from final
union all
select 'acac1000-0000-0000-0000-000000000002', c.id from competitions c
where c.id <> (select competition_id from final);

create temp view due as
  select d.user_id, d.kind, d.evening, d.payload
  from private.reminder_due((select t0 from clock)) d
  where d.user_id::text like 'acac0000-%' and d.kind = 'forgotten';

select is((select jsonb_path_query_array(payload, '$.events[*].slug') from due
           where user_id = 'acac0000-0000-0000-0000-000000000001'),
  (select jsonb_agg(slug) from final),
  'a member of a league counting the competition is reminded without any prediction in it');
select is((select count(*)::int from due where user_id = 'acac0000-0000-0000-0000-000000000002'),
  0, 'nothing when the player''s leagues count other competitions only');
select is((select count(*)::int from due where user_id = 'acac0000-0000-0000-0000-000000000003'),
  0, 'nothing for a player with neither a league nor a prediction in the competition');

-- Sent: not twice the same evening.
select private.reminder_mark_sent((select jsonb_agg(jsonb_build_object(
  'user_id', d.user_id, 'kind', d.kind, 'evening', d.evening)) from due d));
select is((select count(*)::int from private.reminder_due((select t0 from clock) + interval '5 minutes') d
           where d.user_id = 'acac0000-0000-0000-0000-000000000001' and d.kind = 'forgotten'),
  0, 'a player already reminded this evening is not reminded twice');

select * from finish();
rollback;
