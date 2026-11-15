import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { onPreprod, sql } from "../src/infra/contract/database";

/**
 * What a player could meet if a run left it behind (#947): accounts, competitions, leagues,
 * Manager leagues, athletes, clubs, disciplines, polls, episodes, fun facts. Each one by its key,
 * and the column that names it in the error.
 */
const TABLES: Record<string, { key: string; label: string }> = {
  "auth.users": { key: "id", label: "email" },
  competitions: { key: "id", label: "slug" },
  leagues: { key: "id", label: "name" },
  manager_leagues: { key: "id", label: "name" },
  athletes: { key: "id", label: "slug" },
  clubs: { key: "id", label: "name" },
  disciplines: { key: "name", label: "name" },
  polls: { key: "id", label: "question" },
  announcements: { key: "id", label: "title" },
  fun_facts: { key: "id", label: "title" },
};

type Snapshot = Record<string, string[]>;

const snapshotFile = join(tmpdir(), "french-track-e2e-before.json");

const SEPARATOR = "\x1f";

/** A column of every row, on one line: sql() keeps the first line of psql's output only. */
function column(table: string, name: string, where = "true"): string[] {
  const values = sql(
    `select coalesce(string_agg(${name}::text, E'\\x1f'), '') from ${table} where ${where}`,
  );
  return values === "" ? [] : values.split(SEPARATOR);
}

/**
 * Global set-up, locally and in the CI of each PR: notes what the database holds before the run.
 * Not in pre-production, where demo players make leagues during the run.
 */
export default function noteWhatIsThere(): void {
  if (onPreprod()) return;
  const before: Snapshot = {};
  for (const [table, { key }] of Object.entries(TABLES)) before[table] = column(table, key);
  writeFileSync(snapshotFile, JSON.stringify(before));
}

/**
 * Called by the global teardown once ci/preprod/cleanup-e2e.sql has run: throws if the run left
 * anything it made, so a name the clean-up misses turns the CI red (#947). Nothing to compare
 * when the set-up did not run (pre-production).
 */
export function expectNothingLeft(): void {
  if (onPreprod()) return;
  const before = JSON.parse(readFileSync(snapshotFile, "utf8")) as Snapshot;
  const left: string[] = [];
  for (const [table, { key, label }] of Object.entries(TABLES)) {
    const known = new Set(before[table]);
    const added = column(table, key).filter((k) => !known.has(k));
    if (added.length === 0) continue;
    const keys = added.map((k) => `'${k.replaceAll("'", "''")}'`).join(", ");
    left.push(`${table}: ${column(table, label, `${key}::text in (${keys})`).join(", ")}`);
  }
  if (left.length > 0) {
    throw new Error(`the e2e run left data that cleanup-e2e.sql misses: ${left.join("; ")}`);
  }
}
