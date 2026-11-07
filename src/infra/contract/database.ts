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
