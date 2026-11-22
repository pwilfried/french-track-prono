"use client";

import { useState } from "react";

import { messages } from "@/app/messages.fr";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { MANAGER_BONUSES, type ManagerRules } from "@/domain/manager-rules";

const text = messages.manager;

export type LeagueRules = Pick<
  ManagerRules,
  "budget" | "minTeamSize" | "lineup" | "tablesDivisor" | "bonuses"
>;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

/**
 * « Règles de la ligue » (#1036): a button that opens the rules frozen at the creation of the league
 * in a sheet over the page, in four parts: « À chaque compétition », « Remplacements », « Points »
 * (the divisor and the table of bonuses) and « Saison » (`season`, the format of the season).
 */
export function LeagueRulesSheet({
  rules,
  season,
  defaultOpen = false,
}: {
  rules: LeagueRules;
  season: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const list = "flex flex-col gap-1.5 rounded-card bg-muted p-4 text-sm";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex min-h-11 items-center self-start font-semibold text-brand dark:text-secondary"
      >
        {text.rulesOpen} ›
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={text.rules}>
        <div className="flex flex-col gap-4">
          <Section title={text.rulesSections.competition}>
            <ul className={list}>
              <li>{text.lineup(rules.lineup.max, rules.lineup.perFamily, rules.lineup.bench)}</li>
              <li>{text.reserve}</li>
              <li>{text.discipline}</li>
              <li>{text.forgotten}</li>
            </ul>
          </Section>
          <Section title={text.rulesSections.substitutions}>
            <ul className={list}>
              <li>{text.forfeitRule}</li>
              <li>{text.tacticalRule}</li>
              <li>{text.substituteRule}</li>
            </ul>
          </Section>
          <Section title={text.rulesSections.points}>
            <p className="text-sm">{text.tables(rules.tablesDivisor)}</p>
            <table className="w-full text-sm">
              <caption className="pb-1 text-left text-xs font-semibold text-muted-foreground">
                {text.bonusTable}
              </caption>
              <tbody>
                {MANAGER_BONUSES.map((b) => (
                  <tr key={b} className="border-b border-border last:border-0">
                    <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                      {text.bonusName[b]}
                    </th>
                    <td className="py-1.5 text-right font-mono font-bold tabular-nums text-gold-ink">
                      {text.bonusValue(rules.bonuses[b])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-sm font-semibold">{text.noPredictions}</p>
          </Section>
          <Section title={text.rulesSections.season}>
            <ul className={list}>
              <li>{text.budget(rules.budget)}</li>
              <li>{text.minTeamSize(rules.minTeamSize)}</li>
              <li>{season}</li>
              <li>{text.duels}</li>
            </ul>
          </Section>
        </div>
      </BottomSheet>
    </>
  );
}
