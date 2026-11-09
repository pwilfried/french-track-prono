import { describe, it } from "vitest";

import { clubDirectoryContract } from "./contract/club-directory.contract";
import { sql } from "./contract/database";
import {
  createInMemoryClubDirectory,
  createPublicSupabaseClient,
  createSupabaseClubDirectory,
} from "./index";

clubDirectoryContract("in-memory fake", async () => {
  const directory = createInMemoryClubDirectory();
  return {
    directory,
    async importClubs(clubs) {
      clubs.forEach((club) => directory.add(club));
    },
    async addUnvalidated(name) {
      directory.add({ name, city: "", department: "", validated: false });
    },
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const quote = (text: string) => `'${text.replaceAll("'", "''")}'`;
const siren = () => String(Math.floor(100_000_000 + Math.random() * 899_999_999));

if (url && key) {
  clubDirectoryContract("Supabase (local)", async () => ({
    directory: createSupabaseClubDirectory(createPublicSupabaseClient()),
    async importClubs(clubs) {
      const rows = clubs.map((club) => ({ ...club, siren: siren() }));
      sql(`select import_clubs(${quote(JSON.stringify(rows))}::jsonb)`);
    },
    async addUnvalidated(name) {
      sql(`insert into clubs (name, source) values (${quote(name)}, 'player')`);
    },
  }));
} else {
  describe("Supabase club directory", () => {
    const message = "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set";
    if (process.env.REQUIRE_SUPABASE_TESTS) {
      it("has a local Supabase configured", () => {
        throw new Error(message);
      });
    } else {
      it.skip(`is skipped: ${message}`, () => {});
    }
  });
}
