import { describe, it } from "vitest";

import type { ManagerRuleSet } from "@/application/manager-rules";

import { sql } from "./contract/database";
import { managerLeagueRepositoryContract } from "./contract/manager-league-repository.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryManagerLeagueStore, createSupabaseManagerLeagueRepository } from "./index";

managerLeagueRepositoryContract("in-memory fake", async () => {
  const rules: { current: ManagerRuleSet } = {
    current: {
      rules: {
        budget: 100,
        teamSize: 1,
        quotas: [{ sex: "F", family: "sprint", min: 1, max: 1 }],
        lineup: { max: 1, minPerFamily: {} },
        rounds: { firstHours: 48, longRounds: 2, nextHours: 24 },
        closeModes: ["scheduled"],
        bonuses: {
          first: 10,
          second: 6,
          third: 3,
          personal_best: 5,
          season_best: 3,
          national_record: 10,
          area_record: 15,
          world_record: 25,
        },
        season: { startsOn: "2027-01-01", endsOn: "2027-12-31" },
      },
      competitionSlugs: [],
    },
  };
  const store = createInMemoryManagerLeagueStore(rules);
  return {
    creator: store.session({
      userId: "u1",
      pseudo: "Créatrice",
      bib: { number: 7, color: "blue" },
    }),
    creatorId: "u1",
    other: store.session({ userId: "u2", pseudo: "Autre", bib: { number: 7, color: "blue" } }),
    setBudget: async (budget) => {
      rules.current = { ...rules.current, rules: { ...rules.current.rules, budget } };
    },
    openMercato: async (id) => store.openMercato(id),
    restore: async () => {},
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  managerLeagueRepositoryContract("Supabase (local)", async () => {
    const [creator, other] = await Promise.all([
      signedInPlayer(url, key),
      signedInPlayer(url, key),
    ]);
    const budget = sql("select rules ->> 'budget' from manager_rules");
    const setBudget = async (value: number) =>
      void sql(`update manager_rules set rules = jsonb_set(rules, '{budget}', '${value}')`);
    return {
      creator: createSupabaseManagerLeagueRepository(creator.client),
      creatorId: creator.userId,
      other: createSupabaseManagerLeagueRepository(other.client),
      setBudget,
      openMercato: async (id) =>
        void sql(`update manager_leagues set mercato_opened_at = now() where id = '${id}'`),
      restore: () => setBudget(Number(budget)),
    };
  });
} else {
  describe("Supabase Manager league repository", () => {
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
