import { execFileSync } from "node:child_process";

// Direct access to the local Supabase database, for test set-up only (making an admin, creating
// an isolated event). The app never connects this way. Uses `psql` when it is installed, else the
// one inside the Supabase database container.
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

/** Runs SQL on the local database and returns the first column of the first row. */
export function sql(statement: string): string {
  const args = ["-tA", "-v", "ON_ERROR_STOP=1", "-c", statement];
  const output = hasPsql()
    ? execFileSync("psql", [url, ...args], { encoding: "utf8" })
    : execFileSync("docker", ["exec", container, "psql", "-U", "postgres", ...args], {
        encoding: "utf8",
      });
  return output.trim().split("\n")[0] ?? "";
}

/**
 * An event of its own in a competition of its own, so that no other test (nor the seed counts)
 * sees it: four athletes on the start list and a fifth one who is not. Its predictions lock in an
 * hour.
 */
export function createTestEvent(): {
  competitionSlug: string;
  eventId: string;
  athleteIds: string[];
  outsiderId: string;
} {
  const tag = crypto.randomUUID().slice(0, 8);
  const competitionSlug = `test-${tag}`;
  const ids = sql(
    "select string_agg(id::text, ',' order by id) from (select id from athletes order by id limit 5) a",
  ).split(",");
  const athleteIds = ids.slice(0, 4);
  const eventId = sql(`
    with c as (
      insert into competitions (slug, name, starts_on, ends_on)
      values ('${competitionSlug}', 'Test ${tag}', current_date, current_date + 1) returning id
    ), e as (
      insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
      select c.id, 'test-event-${tag}', '100 m', 'F', now() + interval '1 day', now() + interval '1 hour'
      from c returning id
    ), s as (
      insert into entries (event_id, athlete_id)
      select e.id, a.id::uuid from e, unnest(array['${athleteIds.join("','")}']) as a(id)
      returning event_id
    )
    select id from e`);
  return { competitionSlug, eventId, athleteIds, outsiderId: ids[4]! };
}
