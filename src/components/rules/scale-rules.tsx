import type { ReactNode } from "react";

import { messages } from "@/app/messages.fr";
import type { Discipline } from "@/domain/discipline";

const t = messages.rules;
const ODDS_EXAMPLE = 2.5;

/** A titled part of the rules, labelled by its heading. */
export function RulesSection({
  id,
  title,
  level = 2,
  children,
}: {
  id: string;
  title: string;
  level?: 2 | 3;
  children: ReactNode;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <Heading
        id={id}
        className={level === 2 ? "font-display text-xl font-extrabold" : "text-lg font-extrabold"}
      >
        {title}
      </Heading>
      {children}
    </section>
  );
}

/**
 * The scale explained (#263, #703): podium, odds, marks, joker, coup de flair, with the current
 * points. One source for the « Comment jouer » page and the rules sheet of the podium picker.
 */
export function ScaleRules({
  scale,
  tolerances = [],
  level = 2,
  idPrefix = "",
}: {
  /** The stored scale, by rule key (see app/scale.ts). */
  scale: Record<string, number>;
  /** Example tolerances, listed under the marks. */
  tolerances?: Pick<Discipline, "name" | "tolerance" | "unit">[];
  /** Heading level of each section: 2 on the page, 3 in the sheet (under its title). */
  level?: 2 | 3;
  /** Keeps the section ids unique when the rules sit inside another page. */
  idPrefix?: string;
}) {
  const r = (key: string) => scale[key] ?? 0;
  const id = (name: string) => `${idPrefix}${name}`;
  return (
    <>
      <RulesSection id={id("podium")} title={t.podiumTitle} level={level}>
        <p>{t.podium(r("exact_slot"), r("wrong_place"), r("perfect_podium"))}</p>
        <p className="rounded-2xl bg-muted px-3.5 py-3 text-sm">
          {t.podiumExample(r("exact_slot"), r("perfect_podium"))}
        </p>
      </RulesSection>

      <RulesSection id={id("odds")} title={t.oddsTitle} level={level}>
        <p>{t.odds(r("odds_exact"), r("odds_one_off"), r("odds_two_off"))}</p>
        <p>{t.other}</p>
        <p className="rounded-2xl bg-muted px-3.5 py-3 text-sm">
          {t.oddsExample(
            ODDS_EXAMPLE.toFixed(2).replace(".", ","),
            r("odds_exact"),
            Math.round(ODDS_EXAMPLE * r("odds_exact")),
          )}
        </p>
      </RulesSection>

      <RulesSection id={id("marks")} title={t.marksTitle} level={level}>
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
      </RulesSection>

      <RulesSection id={id("joker")} title={t.jokerTitle} level={level}>
        <p>{t.joker(r("joker_multiplier"))}</p>
      </RulesSection>

      <RulesSection id={id("flair")} title={t.flairTitle} level={level}>
        <p>{t.flair(r("flair_bonus"), r("flair_threshold"), r("flair_min_players"))}</p>
      </RulesSection>
    </>
  );
}
