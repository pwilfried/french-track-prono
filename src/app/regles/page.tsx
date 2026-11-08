import type { Metadata } from "next";

import { listDisciplines } from "@/application/disciplines";
import { UseCaseError } from "@/application/errors";
import { listScoringRules } from "@/application/scoring-rules";
import type { Discipline } from "@/domain/discipline";
import { DEFAULT_RULES } from "@/domain/scoring";
import {
  createPublicSupabaseClient,
  createSupabaseDisciplineRepository,
  createSupabaseScoringRuleRepository,
} from "@/infra";

import { messages } from "../messages.fr";

export const metadata: Metadata = { title: messages.rules.title };

/** The scale as stored (the admin can change it); the defaults when it cannot be read. */
async function loadScale(): Promise<Record<string, number>> {
  const defaults: Record<string, number> = {
    exact_slot: DEFAULT_RULES.exactSlot,
    wrong_place: DEFAULT_RULES.wrongPlace,
    perfect_podium: DEFAULT_RULES.perfectPodium,
    flair_bonus: DEFAULT_RULES.flairBonus,
    flair_threshold: DEFAULT_RULES.flairThreshold,
    flair_min_players: DEFAULT_RULES.flairMinPlayers,
    joker_multiplier: DEFAULT_RULES.jokerMultiplier,
    odds_exact: DEFAULT_RULES.oddsExact,
    odds_one_off: DEFAULT_RULES.oddsOneOff,
    odds_two_off: DEFAULT_RULES.oddsTwoOff,
    mark_exact: DEFAULT_RULES.markExact,
    mark_near: DEFAULT_RULES.markNear,
  };
  try {
    const rules = await listScoringRules({
      rules: createSupabaseScoringRuleRepository(createPublicSupabaseClient()),
    }).execute();
    return { ...defaults, ...Object.fromEntries(rules.map((r) => [r.key, r.value])) };
  } catch (error) {
    if (error instanceof UseCaseError) return defaults;
    throw error;
  }
}

async function loadTolerances(): Promise<Discipline[]> {
  try {
    const all = await listDisciplines({
      disciplines: createSupabaseDisciplineRepository(createPublicSupabaseClient()),
    }).execute();
    const examples = ["100 m", "400 m", "Saut en longueur", "Saut en hauteur", "Lancer du javelot"];
    return all.filter((d) => examples.includes(d.name));
  } catch (error) {
    if (error instanceof UseCaseError) return [];
    throw error;
  }
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="font-display text-xl font-extrabold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** « Comment jouer » (#263): the rules with the current scale and worked examples, then a FAQ. */
export default async function RulesPage() {
  const [scale, tolerances] = await Promise.all([loadScale(), loadTolerances()]);
  const r = (key: string) => scale[key] ?? 0;
  const t = messages.rules;
  const example = 2.5;

  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6 leading-relaxed"
    >
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-extrabold leading-tight">{t.title}</h1>
        <p className="text-muted-foreground">{t.intro}</p>
      </div>

      <Section id="podium" title={t.podiumTitle}>
        <p>{t.podium(r("exact_slot"), r("wrong_place"), r("perfect_podium"))}</p>
        <p className="rounded-2xl bg-muted px-3.5 py-3 text-sm">
          {t.podiumExample(r("exact_slot"), r("perfect_podium"))}
        </p>
      </Section>

      <Section id="odds" title={t.oddsTitle}>
        <p>{t.odds(r("odds_exact"), r("odds_one_off"), r("odds_two_off"))}</p>
        <p>{t.other}</p>
        <p className="rounded-2xl bg-muted px-3.5 py-3 text-sm">
          {t.oddsExample(
            example.toFixed(2).replace(".", ","),
            r("odds_exact"),
            Math.round(example * r("odds_exact")),
          )}
        </p>
      </Section>

      <Section id="marks" title={t.marksTitle}>
        <p>{t.marks(r("mark_exact"), r("mark_near"))}</p>
        {tolerances.length > 0 && (
          <div className="rounded-2xl border border-border p-3.5">
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t.tolerancesTitle}
            </h3>
            <dl className="flex flex-col gap-1 text-sm">
              {tolerances.map((d) => (
                <div key={d.name} className="flex justify-between gap-3">
                  <dt>{d.name}</dt>
                  <dd className="font-mono font-bold">
                    {messages.picker.tolerance(d.tolerance, d.unit)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </Section>

      <Section id="joker" title={t.jokerTitle}>
        <p>{t.joker(r("joker_multiplier"))}</p>
      </Section>

      <Section id="flair" title={t.flairTitle}>
        <p>{t.flair(r("flair_bonus"), r("flair_threshold"), r("flair_min_players"))}</p>
      </Section>

      <Section id="lock" title={t.lockTitle}>
        <p>{t.lock}</p>
      </Section>

      <Section id="faq" title={t.faqTitle}>
        <div className="flex flex-col gap-2">
          {t.faq.map((item) => (
            <details key={item.q} className="rounded-2xl border border-border bg-card px-3.5 py-2">
              <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
                {item.q}
              </summary>
              <p className="pb-2 text-sm text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </Section>
    </main>
  );
}
