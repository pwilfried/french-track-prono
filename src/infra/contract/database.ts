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
    "select string_agg(id::text, ',' order by id) from (select id from athletes order by id limit 5) a",
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
