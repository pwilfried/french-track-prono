import { readFileSync } from "node:fs";
import { join } from "node:path";

import { onPreprod, sql } from "../src/infra/contract/database";

/**
 * Global set-up of the runs against pre-production (#776): the tests start from open events of the
 * Ultimate Championship, as locally and in the CI of each PR after `npm run db:open-events`. The
 * pre-production database is never reset and its seed has the real, past dates, so the same
 * script moves the schedule to now before every run (idempotent: it starts from the new « now »).
 * Does nothing locally nor in the CI of a PR, where the workflow runs the script itself.
 *
 * Pre-production also holds the demo set (supabase/preprod/demo.sql), whose competitions are under
 * way or to come; the app opens the earliest of those, and the tests expect the Ultimate
 * Championship there, as locally where it is alone (#819). Its dates are moved too: it starts the
 * day before the earliest other competition still running and lasts the three days of the moved
 * schedule.
 */
export default function openEventsOnPreprod(): void {
  if (!onPreprod()) return;
  sql(readFileSync(join(__dirname, "../supabase/dev/open_events.sql"), "utf8"));
  sql(`update competitions c
       set starts_on = least(current_date, coalesce((select min(o.starts_on) from competitions o
                         where o.ends_on >= current_date and o.id <> c.id), current_date)) - 1,
           ends_on = current_date + 3
       where c.slug = 'ultimate-championship-2026'`);
}
