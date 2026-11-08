import { UseCaseError } from "@/application/errors";
import { listScoringRules, type ScoringRule } from "@/application/scoring-rules";
import { ErrorNotice } from "@/components/error-notice";
import { createSupabaseScoringRuleRepository } from "@/infra";

import { messages } from "../../messages.fr";
import { AdminShell } from "../competitions/admin-shell";
import { adminOnly } from "../guard";
import { RuleForm } from "./rule-form";

const GROUPS = {
  podium: ["exact_slot", "wrong_place", "perfect_podium"],
  bonus: ["flair_bonus", "flair_threshold", "flair_min_players", "joker_multiplier"],
  odds: ["odds_exact", "odds_one_off", "odds_two_off"],
  marks: ["mark_exact", "mark_near"],
} as const;

/** The scale (#262): every value the points are computed with, adjustable by the admin. */
export default async function ScalePage() {
  const { client } = await adminOnly();
  let rules: ScoringRule[] | "error";
  try {
    rules = await listScoringRules({
      rules: createSupabaseScoringRuleRepository(client),
    }).execute();
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    rules = "error";
  }

  return (
    <AdminShell title={messages.scale.title} section="scale">
      <p className="text-sm text-muted-foreground">{messages.scale.subtitle}</p>
      {rules === "error" ? (
        <ErrorNotice
          retryHref="/admin/bareme"
          message={messages.errors.SCORING_RULES_UNAVAILABLE}
        />
      ) : (
        (Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((group) => {
          const inGroup = rules.filter((r) => (GROUPS[group] as readonly string[]).includes(r.key));
          if (inGroup.length === 0) return null;
          return (
            <section key={group} aria-labelledby={`group-${group}`} className="flex flex-col gap-2">
              <h2
                id={`group-${group}`}
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                {messages.scale.groups[group]}
              </h2>
              <ul className="flex flex-col gap-2">
                {inGroup.map((rule) => (
                  <li key={rule.key} className="rounded-card border border-border bg-card p-3">
                    <RuleForm ruleKey={rule.key} value={rule.value} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </AdminShell>
  );
}
