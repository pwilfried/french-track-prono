import { describe, it } from "vitest";

import { lockSharedRow, sql } from "./contract/database";
import { managerRuleRepositoryContract } from "./contract/manager-rule-repository.contract";
import { signedInPlayer } from "./contract/test-player";
import { createInMemoryManagerRuleStore, createSupabaseManagerRuleRepository } from "./index";

managerRuleRepositoryContract("in-memory fake", async () => {
  const store = createInMemoryManagerRuleStore(
    {
      rules: {
        budget: 100,
        minTeamSize: 1,
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
    ["meeting-manager"],
  );
  return {
    admin: store.session({ isAdmin: true }),
    player: store.session({ isAdmin: false }),
    competitionSlug: "meeting-manager",
    restore: async () => {},
  };
});

// The real adapter runs only when a local Supabase is configured (.env.local or CI).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (url && key) {
  managerRuleRepositoryContract("Supabase (local)", async () => {
    const [admin, player] = await Promise.all([signedInPlayer(url, key), signedInPlayer(url, key)]);
    sql(`update profiles set is_admin = true where id = '${admin.userId}'`);
    const slug = `manager-${crypto.randomUUID().slice(0, 8)}`;
    sql(`insert into competitions (slug, name, starts_on, ends_on)
         values ('${slug}', 'Meeting Manager', '2027-06-01', '2027-06-01')`);
    // The rules are one row, also changed by the Manager league tests: hold it until restore().
    const unlock = await lockSharedRow("manager_rules");
    const rules = sql("select rules::text from manager_rules");
    const eligible = sql(
      "select coalesce(string_agg(competition_id::text, ','), '') from manager_competitions",
    );
    return {
      admin: createSupabaseManagerRuleRepository(admin.client),
      player: createSupabaseManagerRuleRepository(player.client),
      competitionSlug: slug,
      restore: async () => {
        try {
          sql(`update manager_rules set rules = '${rules.replaceAll("'", "''")}'`);
          sql(`delete from manager_competitions;
               insert into manager_competitions (competition_id)
               select unnest(string_to_array('${eligible}', ','))::uuid;
               delete from competitions where slug = '${slug}'`);
        } finally {
          unlock();
        }
      },
    };
  });
} else {
  describe("Supabase Manager rule repository", () => {
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
