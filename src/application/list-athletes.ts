import type { Discipline } from "@/domain/discipline";
import {
  suggestManagerPrice,
  type ManagerPricing,
  type PriceSuggestion,
} from "@/domain/manager-price";

import type { AthleteAdminRepository, AthleteFile, AthleteListItem } from "./edit-athlete";
import { UseCaseError } from "./errors";

/** Every athlete for the back-office, by name. */
export function listAthletes(ports: { athletes: AthleteAdminRepository }) {
  return {
    async execute(): Promise<AthleteListItem[]> {
      return (await ports.athletes.list()).sort((a, b) => a.name.localeCompare(b.name));
    },
  };
}

/** One athlete for the back-office, main discipline first. */
export function getAthleteFile(ports: { athletes: AthleteAdminRepository }) {
  return {
    async execute(input: { slug: string }): Promise<AthleteFile> {
      const file = await ports.athletes.find(input.slug);
      if (!file) throw new UseCaseError("ATHLETE_NOT_FOUND");
      return {
        ...file,
        disciplines: [...file.disciplines].sort(
          (a, b) =>
            Number(b.isPrimary) - Number(a.isPrimary) || a.discipline.localeCompare(b.discipline),
        ),
      };
    },
  };
}

/**
 * The Manager price the back-office suggests for an athlete (#1028), from the PB and SB of their
 * main discipline; null when there is nothing to price them on. The admin keeps their own price.
 */
export function athletePriceSuggestion(input: {
  file: AthleteFile;
  disciplines: Discipline[];
  pricing: ManagerPricing;
  today: string;
}): PriceSuggestion | null {
  const { file } = input;
  const main = file.disciplines.find((d) => d.isPrimary)?.discipline;
  const discipline = input.disciplines.find((d) => d.name === main) ?? null;
  return suggestManagerPrice(
    {
      sex: file.gender,
      discipline,
      records: file.records.flatMap((r) =>
        r.discipline === main && (r.kind === "pr" || r.kind === "sb")
          ? [{ kind: r.kind, mark: r.mark, date: r.date }]
          : [],
      ),
      condition: file.condition,
      presence: file.presence,
      today: input.today,
    },
    input.pricing,
  );
}
