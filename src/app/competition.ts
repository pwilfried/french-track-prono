import { messages } from "./messages.fr";

type CompetitionSlug = keyof typeof messages.competitions;

/** Time zone of each competition the app knows; its French name and place live in the messages. */
const TIME_ZONES: Record<CompetitionSlug, string> = {
  "ultimate-championship-2026": "Europe/Budapest",
  "european-championships-2026": "Europe/London",
};

const isKnown = (slug: string | undefined): slug is CompetitionSlug =>
  slug !== undefined && slug in TIME_ZONES;

/** The competition shown by the app, chosen with COMPETITION_SLUG (server environment). */
export const COMPETITION_SLUG: CompetitionSlug = isKnown(process.env.COMPETITION_SLUG)
  ? process.env.COMPETITION_SLUG
  : "ultimate-championship-2026";
export const COMPETITION_TIME_ZONE = TIME_ZONES[COMPETITION_SLUG];
export const COMPETITION_TEXT = messages.competitions[COMPETITION_SLUG];
