import { readFileSync } from "node:fs";
import { join } from "node:path";

import { onPreprod, sql } from "../src/infra/contract/database";

/**
 * Global set-up of the runs against pre-production (#776): the tests start from open events of the
 * Ultimate Championship, as locally and in the CI of each PR after `npm run db:open-events`. The
 * pre-production database is never reset and its seed has the real, past dates, so the same
 * script moves the schedule to now before every run (idempotent: it starts from the new « now »).
 * Does nothing locally nor in the CI of a PR, where the workflow runs the script itself.
 */
export default function openEventsOnPreprod(): void {
  if (!onPreprod()) return;
  sql(readFileSync(join(__dirname, "../supabase/dev/open_events.sql"), "utf8"));
}
