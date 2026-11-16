import type { ManagerRuleSet } from "@/application/manager-rules";
import {
  MANAGER_BONUSES,
  MANAGER_FAMILIES,
  MERCATO_CLOSE_MODES,
  type ManagerRules,
} from "@/domain/manager-rules";

import { formText } from "../../form-data";

/** A number as typed (a decimal comma is fine); an empty field is not a number. */
const num = (data: FormData, name: string) => {
  const text = formText(data, name).trim().replace(",", ".");
  return text === "" ? NaN : Number(text);
};

/** The rules form of the back-office, field by field; the use case checks the values. */
export function parseManagerRulesForm(data: FormData): ManagerRuleSet {
  const rules: ManagerRules = {
    budget: num(data, "budget"),
    minTeamSize: num(data, "minTeamSize"),
    quotas: MANAGER_FAMILIES.map((family) => ({
      family,
      min: num(data, `quota.${family}.min`),
      minPerSex: num(data, `quota.${family}.minPerSex`),
      maxPerSex: num(data, `quota.${family}.maxPerSex`),
    })),
    // No free place (#1017): the starters are the places of the four families.
    lineup: {
      max: num(data, "lineup.perFamily") * MANAGER_FAMILIES.length,
      perFamily: num(data, "lineup.perFamily"),
      bench: num(data, "lineup.bench"),
    },
    tablesDivisor: num(data, "tablesDivisor"),
    rounds: {
      firstHours: num(data, "rounds.firstHours"),
      longRounds: num(data, "rounds.longRounds"),
      nextHours: num(data, "rounds.nextHours"),
    },
    closeModes: MERCATO_CLOSE_MODES.filter((m) => data.get(`close.${m}`) === "on"),
    bonuses: Object.fromEntries(
      MANAGER_BONUSES.map((b) => [b, num(data, `bonus.${b}`)]),
    ) as ManagerRules["bonuses"],
    season: {
      startsOn: formText(data, "season.startsOn"),
      endsOn: formText(data, "season.endsOn"),
    },
  };
  return {
    rules,
    competitionSlugs: data.getAll("competition").filter((v): v is string => typeof v === "string"),
  };
}
