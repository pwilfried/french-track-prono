import type { AthleteAdminRepository, AthleteSummary, AthleteFile } from "./edit-athlete";
import { UseCaseError } from "./errors";

/** Every athlete for the back-office, by name. */
export function listAthletes(ports: { athletes: AthleteAdminRepository }) {
  return {
    async execute(): Promise<AthleteSummary[]> {
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
