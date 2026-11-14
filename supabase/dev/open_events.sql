-- Test tooling only: never part of the migrations or of seed.sql. Run locally (npm run db:open-events),
-- in the CI of each PR, and before each e2e run against pre-production (e2e/preprod-events.ts, #776).
--
-- The Ultimate Championship is over, so every seeded event is locked. This script moves the whole
-- schedule (same order, same spacing, same days) so that it starts now:
--   * the first event starts in 3 minutes, so its lock (5 minutes before) has just passed;
--   * every other event is still open, over the next three days.
-- Official results are removed so the answer is not on the page. `supabase db reset` brings the
-- real schedule and results back. Running it again moves the schedule forward to the new "now".
begin;

with first_start as (
  select min(starts_at) as t
  from events
  where competition_id = (select id from competitions where slug = 'ultimate-championship-2026')
),
shift as (
  select date_trunc('minute', now()) + interval '3 minutes' - t as by from first_start
)
update events e
set starts_at = e.starts_at + shift.by,
    lock_at   = e.starts_at + shift.by - interval '5 minutes',
    status    = 'upcoming'
from shift
where e.competition_id = (select id from competitions where slug = 'ultimate-championship-2026');

delete from results
where event_id in (
  select id from events
  where competition_id = (select id from competitions where slug = 'ultimate-championship-2026')
);

commit;
