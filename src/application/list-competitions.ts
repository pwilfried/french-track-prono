import type {
  CompetitionAdminRepository,
  CompetitionFile,
  CompetitionSummary,
} from "./create-competition";
import { UseCaseError } from "./errors";

/** Every competition, the coming ones first (by start date), then the finished ones. */
export function listCompetitions(ports: { competitions: CompetitionAdminRepository }) {
  return {
    async execute(input: {
      today: string;
    }): Promise<{ coming: CompetitionSummary[]; past: CompetitionSummary[] }> {
      const all = await ports.competitions.list();
      return {
        coming: all
          .filter((c) => c.endsOn >= input.today)
          .sort((a, b) => a.startsOn.localeCompare(b.startsOn)),
        past: all
          .filter((c) => c.endsOn < input.today)
          .sort((a, b) => b.startsOn.localeCompare(a.startsOn)),
      };
    },
  };
}

/** One competition with its events (in running order) and its entered athletes (by name). */
export function getCompetitionFile(ports: { competitions: CompetitionAdminRepository }) {
  return {
    async execute(input: { slug: string }): Promise<CompetitionFile> {
      const file = await ports.competitions.find(input.slug);
      if (!file) throw new UseCaseError("COMPETITION_NOT_FOUND");
      return {
        ...file,
        eventList: [...file.eventList].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
        athletes: [...file.athletes].sort((a, b) => a.name.localeCompare(b.name)),
      };
    },
  };
}
