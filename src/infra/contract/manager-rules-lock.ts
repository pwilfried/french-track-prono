import { mkdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The local database has one row of Manager rules, and Vitest runs test files in parallel: a test
// that changes those rules holds this lock (a directory, created atomically) until it restores
// them, so that no other test file changes them in between.
const lock = join(tmpdir(), "french-track-prono-manager-rules.lock");
const staleAfterMs = 60_000;
const waitMs = 15_000;

/** Waits for the Manager rules of the local database, then returns the function that frees them. */
export async function lockManagerRules(): Promise<() => void> {
  const deadline = Date.now() + waitMs;
  for (;;) {
    try {
      mkdirSync(lock);
      return () => rmSync(lock, { recursive: true, force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    if (isStale()) rmSync(lock, { recursive: true, force: true });
    if (Date.now() > deadline) throw new Error(`Manager rules still locked: ${lock}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** A lock left behind by an interrupted run. */
function isStale(): boolean {
  try {
    return Date.now() - statSync(lock).mtimeMs > staleAfterMs;
  } catch {
    return false;
  }
}
