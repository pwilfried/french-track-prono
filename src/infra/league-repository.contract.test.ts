import { describe, it } from "vitest";

import { sql } from "./contract/database";
import { leagueRepositoryContract } from "./contract/league-repository.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryLeagueStore, createSupabaseLeagueRepository } from "./index";

leagueRepositoryContract("in-memory fake", async () => {
  const store = createInMemoryLeagueStore({
    "contract-league-running": "in_progress",
    "contract-league-coming": "coming",
    "contract-league-finished": "finished",
    "contract-league-started": "started",
  });
  return {
    competitionSlug: "contract-league-running",
    comingCompetitionSlug: "contract-league-coming",
    finishedCompetitionSlug: "contract-league-finished",
    startedCompetitionSlug: "contract-league-started",
    newPlayer: async () => {
      const userId = crypto.randomUUID();
      return {
        userId,
        leagues: store.session({
          userId,
          pseudo: userId.slice(0, 8),
          bib: { number: 7, color: "blue" },
        }),
      };
    },
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  leagueRepositoryContract("Supabase (local)", async () => {
    // Far from today's date either way, so that the Paris day never changes their state.
    sql(`insert into competitions (slug, name, starts_on, ends_on)
      values ('contract-league-running', 'Test league running', current_date - 400, current_date + 400),
             ('contract-league-coming', 'Test league coming', current_date + 400, current_date + 401),
             ('contract-league-finished', 'Test league finished', current_date - 400, current_date - 400)
      on conflict (slug) do nothing`);
    // Under way, its only event locked yesterday: its leagues are closed to newcomers (#780).
    sql(`with c as (
        insert into competitions (slug, name, starts_on, ends_on)
        values ('contract-league-started', 'Test league started', current_date - 400, current_date + 400)
        on conflict (slug) do nothing
        returning id
      )
      insert into events (competition_id, slug, discipline, gender, starts_at, lock_at)
      select id, 'contract-league-started-100m', '100 m', 'F', now() - interval '1 day',
             now() - interval '1 day'
      from c`);
    return {
      competitionSlug: "contract-league-running",
      comingCompetitionSlug: "contract-league-coming",
      finishedCompetitionSlug: "contract-league-finished",
      startedCompetitionSlug: "contract-league-started",
      newPlayer: async () => {
        const player = await signedInPlayer(url, key);
        return { userId: player.userId, leagues: createSupabaseLeagueRepository(player.client) };
      },
    };
  });
} else {
  describe("Supabase league repository", () => {
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
