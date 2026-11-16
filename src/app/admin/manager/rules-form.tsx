"use client";

import { useActionState, type ReactNode } from "react";

import type { ManagerRuleSet } from "@/application/manager-rules";
import { messages } from "@/app/messages.fr";
import { SubmitButton } from "@/components/account/submit-button";
import {
  MANAGER_BONUSES,
  MANAGER_FAMILIES,
  MERCATO_CLOSE_MODES,
  type TeamQuota,
} from "@/domain/manager-rules";

import { saveManagerRulesAction, type ManagerRulesState } from "./actions";

const text = messages.managerRules;
const families = messages.team.groups;
const field = "min-h-11 w-full rounded-xl border-2 border-border bg-card px-2.5 text-base";
const QUOTA_BOUNDS = ["min", "minPerSex", "maxPerSex"] as const satisfies (keyof TeamQuota)[];
const small =
  "min-h-11 w-14 rounded-xl border-2 border-border bg-card px-1.5 text-center font-mono text-base";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-card border border-border bg-card p-3.5">
      <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function NumberField({
  label,
  name,
  value,
  decimal = false,
}: {
  label: string;
  name: string;
  value: number;
  decimal?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3 font-semibold">
      {label}
      <input
        name={name}
        defaultValue={decimal ? String(value).replace(".", ",") : String(value)}
        inputMode={decimal ? "decimal" : "numeric"}
        required
        className={`${small} w-20 shrink-0`}
      />
    </label>
  );
}

export type CompetitionChoice = { slug: string; name: string; dates: string };

/** Every rule of French Track Manager in one form, saved at once (#418). */
export function ManagerRulesForm({
  initial,
  competitions,
}: {
  initial: ManagerRuleSet;
  competitions: CompetitionChoice[];
}) {
  const [state, action] = useActionState<ManagerRulesState, FormData>(saveManagerRulesAction, {});
  const { rules } = initial;
  const quota = (family: string) => rules.quotas.find((q) => q.family === family);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Section title={text.team}>
        <NumberField label={text.budget} name="budget" value={rules.budget} />
        <NumberField label={text.minTeamSize} name="minTeamSize" value={rules.minTeamSize} />
        <table className="w-full text-sm">
          <caption className="pb-1 text-left font-semibold">
            {text.quotas}
            <span className="block font-normal text-muted-foreground">{text.quotaHint}</span>
          </caption>
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th scope="col" className="text-left font-semibold">
                {text.family}
              </th>
              {QUOTA_BOUNDS.map((bound) => (
                <th key={bound} scope="col" className="font-semibold">
                  {text.quotaBound[bound]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MANAGER_FAMILIES.map((family) => (
              <tr key={family}>
                <th scope="row" className="py-1 pr-1 text-left font-semibold">
                  {families[family]}
                </th>
                {QUOTA_BOUNDS.map((bound) => (
                  <td key={bound} className="py-1 text-center">
                    <input
                      name={`quota.${family}.${bound}`}
                      aria-label={text.quotaLabel(families[family], text.quotaBound[bound])}
                      defaultValue={String(quota(family)?.[bound] ?? 0)}
                      inputMode="numeric"
                      required
                      className={small}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={text.lineup}>
        <NumberField
          label={text.lineupPerFamily}
          name="lineup.perFamily"
          value={rules.lineup.perFamily}
        />
        <NumberField label={text.lineupBench} name="lineup.bench" value={rules.lineup.bench} />
        <p className="text-sm text-muted-foreground">{text.lineupHint}</p>
      </Section>

      <Section title={text.mercato}>
        <NumberField
          label={text.firstHours}
          name="rounds.firstHours"
          value={rules.rounds.firstHours}
        />
        <NumberField
          label={text.longRounds}
          name="rounds.longRounds"
          value={rules.rounds.longRounds}
        />
        <NumberField
          label={text.nextHours}
          name="rounds.nextHours"
          value={rules.rounds.nextHours}
        />
        <p className="font-semibold">{text.closeModes}</p>
        {MERCATO_CLOSE_MODES.map((mode) => (
          <label key={mode} className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              name={`close.${mode}`}
              defaultChecked={rules.closeModes.includes(mode)}
              className="size-6 shrink-0 accent-primary"
            />
            {text.closeMode[mode]}
          </label>
        ))}
      </Section>

      <Section title={text.points}>
        <NumberField label={text.tablesDivisor} name="tablesDivisor" value={rules.tablesDivisor} />
        <p className="font-semibold">{text.bonuses}</p>
        {MANAGER_BONUSES.map((bonus) => (
          <NumberField
            key={bonus}
            label={text.bonus[bonus]}
            name={`bonus.${bonus}`}
            value={rules.bonuses[bonus]}
          />
        ))}
      </Section>

      <Section title={text.pricing}>
        <p className="text-sm text-muted-foreground">{text.pricingHint}</p>
        {rules.pricing.grid.map((step, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-sm font-semibold">
            <label className="flex items-center gap-2">
              {text.fromPoints}
              <input
                name={`pricing.grid.${i}.minPoints`}
                aria-label={text.stepPoints(i + 1)}
                defaultValue={String(step.minPoints)}
                inputMode="numeric"
                required
                className={`${small} w-20`}
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                name={`pricing.grid.${i}.price`}
                aria-label={text.stepPrice(i + 1)}
                defaultValue={String(step.price)}
                inputMode="numeric"
                required
                className={small}
              />
              {text.credits}
            </label>
          </div>
        ))}
        <NumberField
          label={text.oldMarkPenalty}
          name="pricing.oldMarkPenalty"
          value={rules.pricing.oldMarkPenalty}
          decimal
        />
        <NumberField
          label={text.unfitFactor}
          name="pricing.unfitFactor"
          value={rules.pricing.unfitFactor}
          decimal
        />
        <NumberField
          label={text.rarelyFactor}
          name="pricing.rarelyFactor"
          value={rules.pricing.rarelyFactor}
          decimal
        />
      </Section>

      <Section title={text.season}>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 font-semibold">
            {text.startsOn}
            <input
              type="date"
              name="season.startsOn"
              required
              defaultValue={rules.season.startsOn}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1.5 font-semibold">
            {text.endsOn}
            <input
              type="date"
              name="season.endsOn"
              required
              defaultValue={rules.season.endsOn}
              className={field}
            />
          </label>
        </div>
        <p className="font-semibold">{text.competitions}</p>
        {competitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{text.noCompetition}</p>
        ) : (
          competitions.map((c) => (
            <label key={c.slug} className="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                name="competition"
                value={c.slug}
                defaultChecked={initial.competitionSlugs.includes(c.slug)}
                className="size-6 shrink-0 accent-primary"
              />
              <span>
                <span className="block font-semibold">{c.name}</span>
                <span className="block text-sm text-muted-foreground">{c.dates}</span>
              </span>
            </label>
          ))
        )}
      </Section>

      {state.error && (
        <p role="alert" className="text-sm font-semibold text-accent-text">
          {messages.errors[state.error]}
        </p>
      )}
      {state.saved && (
        <p role="status" className="text-sm font-semibold text-success-text">
          {text.saved}
        </p>
      )}
      <SubmitButton pendingLabel={text.saving}>{text.save}</SubmitButton>
    </form>
  );
}
