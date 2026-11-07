import { execFileSync } from "node:child_process";

// Local Supabase database (docs/SETUP.md). Only for test set-up: the app itself never uses it.
const url =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/** Runs one SQL statement on the local database and returns the first column of the first row. */
export function sql(statement: string): string {
  return execFileSync("psql", [url, "-tA", "-v", "ON_ERROR_STOP=1", "-c", statement], {
    encoding: "utf8",
  }).trim();
}
