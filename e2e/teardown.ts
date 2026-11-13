import { readFileSync } from "node:fs";
import { join } from "node:path";

import { sql } from "../src/infra/contract/database";

/**
 * At the end of every run, failed or not, deletes what it made (#695): test accounts, « E2E »
 * leagues, test competitions (ci/preprod/e2e-cleanup.sql). Needed in pre-production, where the
 * database is never reset; run locally and in the CI of each PR too, so the cleanup is checked.
 */
export default function deleteTestData() {
  sql(readFileSync(join(__dirname, "../ci/preprod/e2e-cleanup.sql"), "utf8"));
  const left = sql(`select count(*) from auth.users
    where email like 'e2e-%@example.test' or email like 'moved-e2e-%@example.test'`);
  if (left !== "0") throw new Error(`${left} e2e account(s) left after the cleanup`);
}
