import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Direct access to the local Supabase database, for test set-up only (making an admin, creating
// an isolated event). The app never connects this way. Uses `psql` when it is installed, else the
// one inside the Supabase database container; the pre-production database when E2E_BASE_URL is set.
const url =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const container = "supabase_db_french-track-prono";

function hasPsql(): boolean {
  try {
    execFileSync("psql", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * In the end-to-end tests (PUBLIC_CACHE_FLUSH_SECRET set by playwright.config.ts), a change made in
 * SQL bypasses the back-office, so the app's cache of public data is expired by hand (#693),
 * before the test goes on. Synchronous like `sql`; does nothing if the app is not up.
 */
function flushPublicCache(): void {
  const secret = process.env.PUBLIC_CACHE_FLUSH_SECRET;
  if (!secret) return;
  const target = `${process.env.PUBLIC_CACHE_FLUSH_URL ?? "http://localhost:3000"}/api/public-cache`;
  const headers = { "x-flush-secret": secret, ...vercelBypassHeaders() };
  const script = `fetch(${JSON.stringify(target)}, { method: "POST", headers: ${JSON.stringify(headers)} }).catch(() => {})`;
  execFileSync(process.execPath, ["-e", script], { stdio: "ignore", timeout: 10_000 });
}

/**
 * The header that gets a request through Vercel Authentication on pre-production (#692), when the
 * VERCEL_AUTOMATION_BYPASS_SECRET is set (pre-production runs only); none otherwise.
 */
export function vercelBypassHeaders(
  env: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const secret = env.VERCEL_AUTOMATION_BYPASS_SECRET;
  return secret ? { "x-vercel-protection-bypass": secret } : {};
}

/**
 * Runs SQL on the test database (local, or pre-production: see onPreprod) and returns the first
 * column of the first row. `keepCache`: the app's cache of public data is left as is (a test that shows the cache at work).
 */
export function sql(statement: string, options: { keepCache?: boolean } = {}): string {
  const output = onPreprod() ? sqlOnPreprod(statement) : sqlOnLocal(statement);
  if (!options.keepCache && !/^\s*select\b/i.test(statement)) flushPublicCache();
  return output.trim().split("\n")[0] ?? "";
}

function sqlOnLocal(statement: string): string {
  const args = ["-tA", "-v", "ON_ERROR_STOP=1", "-c", statement];
  return hasPsql()
    ? execFileSync("psql", [url, ...args], { encoding: "utf8" })
    : execFileSync("docker", ["exec", container, "psql", "-U", "postgres", ...args], {
        encoding: "utf8",
      });
}

/**
 * The end-to-end tests run against pre-production (after each deploy and every morning, #695,
 * #636) when E2E_BASE_URL is set. Never set locally nor in the CI of a PR.
 */
export function onPreprod(): boolean {
  return Boolean(process.env.E2E_BASE_URL);
}

/**
 * Runs SQL on the pre-production database through the Supabase Management API (no database
 * address nor IPv6 needed on the runner, as ci/preprod/load-sql.sh), synchronously like psql.
 * Prints the first column of the first row the way psql -tA does (t/f for booleans).
 */
function sqlOnPreprod(statement: string): string {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (!token || !ref) throw new Error("SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are needed");
  const script = `
    const response = await fetch(
      "https://api.supabase.com/v1/projects/" + process.env.SUPABASE_PROJECT_REF + "/database/query",
      {
        method: "POST",
        headers: {
          authorization: "Bearer " + process.env.SUPABASE_ACCESS_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify({ query: process.env.E2E_SQL }),
      },
    );
    const text = await response.text();
    if (!response.ok) {
      console.error(response.status + " " + text);
      process.exit(1);
    }
    const rows = JSON.parse(text);
    const value = Array.isArray(rows) && rows[0] ? Object.values(rows[0])[0] : null;
    const shown =
      value === null || value === undefined ? "" : value === true ? "t" : value === false ? "f"
        : typeof value === "object" ? JSON.stringify(value) : String(value);
    process.stdout.write(shown);`;
  return execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8",
    env: { ...process.env, E2E_SQL: statement },
    timeout: 60_000,
  });
}

/** Runs a whole SQL script on the local database (psql, stopping at the first error); returns its output. */
export function sqlScript(script: string): string {
  const args = ["-tA", "-q", "-v", "ON_ERROR_STOP=1", "-f", "-"];
  return hasPsql()
    ? execFileSync("psql", [url, ...args], { encoding: "utf8", input: script })
    : execFileSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", ...args], {
        encoding: "utf8",
        input: script,
      });
}

/**
 * Takes a lock shared by every test file (Vitest runs them in parallel workers), for a row that
 * only exists once, like `manager_rules`. Returns the function that frees it. A lock older than
 * a minute is taken as left behind by a crashed worker.
 */
export async function lockSharedRow(name: string): Promise<() => void> {
  const dir = join(tmpdir(), `ftp-test-lock-${name}`);
  for (;;) {
    try {
      mkdirSync(dir);
      return () => rmSync(dir, { recursive: true, force: true });
    } catch {
      try {
        if (Date.now() - statSync(dir).mtimeMs > 60_000)
          rmSync(dir, { recursive: true, force: true });
      } catch {
        // Freed in between: try again.
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

/**
 * The athletes of the seed's start lists, ordered by id. Tests that borrow athletes take them
 * from here, never from the whole table: other test files create athletes with random ids and
 * delete them in parallel, so one of those could be picked and vanish before it is used.
 */
export const seedAthletes = `select distinct en.athlete_id as id from entries en
  join events ev on ev.id = en.event_id
  join competitions c on c.id = ev.competition_id
  where c.slug = 'ultimate-championship-2026' order by en.athlete_id`;

/**
 * A competition of its own, so that no other test (nor the seed counts) sees it: `open` events
 * whose predictions lock in an hour, then `locked` events already locked. Each has the same four
 * athletes on its start list; a fifth athlete is on none.
 */
export function createTestCompetition(counts: { open: number; locked?: number }): {
  competitionSlug: string;
  events: { eventId: string; athleteIds: string[]; locked: boolean }[];
  outsiderId: string;
} {
  const tag = crypto.randomUUID().slice(0, 8);
  const competitionSlug = `test-${tag}`;
  const ids = sql(
    `select string_agg(id::text, ',' order by id) from (${seedAthletes} limit 5) a`,
  ).split(",");
  const athleteIds = ids.slice(0, 4);
  const competitionId = sql(`insert into competitions (slug, name, starts_on, ends_on)
    values ('${competitionSlug}', 'Test ${tag}', current_date, current_date + 1) returning id`);
  const plan = [
    ...Array.from({ length: counts.open }, () => false),
    ...Array.from({ length: counts.locked ?? 0 }, () => true),
  ];
  const events = plan.map((locked, index) => {
    const lock = locked ? "now() - interval '1 hour'" : "now() + interval '1 hour'";
    const eventId = sql(`
      with e as (
        insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
        values ('${competitionId}', 'test-event-${tag}-${index}', '100 m', 'F', now() + interval '1 day', ${lock})
        returning id
      ), s as (
        insert into entries (event_id, athlete_id)
        select e.id, a.id::uuid from e, unnest(array['${athleteIds.join("','")}']) as a(id)
        returning event_id
      )
      select id from e`);
    return { eventId, athleteIds, locked };
  });
  return { competitionSlug, events, outsiderId: ids[4]! };
}

/** One open event in a competition of its own (see createTestCompetition). */
export function createTestEvent(): {
  competitionSlug: string;
  eventId: string;
  athleteIds: string[];
  outsiderId: string;
} {
  const { competitionSlug, events, outsiderId } = createTestCompetition({ open: 1 });
  return {
    competitionSlug,
    eventId: events[0]!.eventId,
    athleteIds: events[0]!.athleteIds,
    outsiderId,
  };
}

/** Puts a test player in a league of his own counting the competition, so he may predict (#311). */
export function joinTestLeague(userId: string, competitionSlug: string): void {
  sql(`with l as (
      insert into leagues (name, owner_id) values ('Ligue de test', '${userId}') returning id
    ), m as (
      insert into league_members (league_id, user_id, role) select id, '${userId}', 'owner' from l
    )
    insert into league_competitions (league_id, competition_id)
    select l.id, c.id from l, competitions c where c.slug = '${competitionSlug}'`);
}

/** The season competitions the Manager tests share: invented, far ahead, never finished. */
export const MANAGER_SEASON_NAME = "Saison Manager";

/**
 * The ids of `count` competitions a Manager league can be created with (#644), first one first:
 * eligible (manager_competitions) and not finished, at least 6 for a league. Shared by every test
 * and made eligible again at each call: the Manager rule tests replace the eligible list for a
 * while. Their names are « Saison Manager 1 » to « Saison Manager 10 »; the first one is in Oslo,
 * of level « continental-tour-gold » (the picker reads both, #663).
 */
export function managerSeasonCompetitions(count = 6): string[] {
  return sql(`
    with c as (
      insert into competitions (slug, name, city, level, starts_on, ends_on)
      select 'test-manager-season-' || n, '${MANAGER_SEASON_NAME} ' || n,
             case when n = 1 then 'Oslo' end, case when n = 1 then 'continental-tour-gold' end,
             date '2030-01-07' + 7 * n, date '2030-01-07' + 7 * n
      from generate_series(1, 10) n
      on conflict (slug) do update set status = 'upcoming', city = excluded.city,
        level = excluded.level
      returning id, starts_on
    ), e as (
      insert into manager_competitions (competition_id) select id from c on conflict do nothing
    )
    select string_agg(id::text, ',' order by starts_on) from (
      select id, starts_on from c order by starts_on limit ${count}
    ) s`).split(",");
}
