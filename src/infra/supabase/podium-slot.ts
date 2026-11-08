import { OTHER_ATHLETE } from "@/domain/podium-draft";

/** « Autre athlète » is stored as null in the p1, p2, p3 columns of predictions. */
export const slotFromRow = (athleteId: string | null): string => athleteId ?? OTHER_ATHLETE;

export const slotToRow = (athleteId: string): string | null =>
  athleteId === OTHER_ATHLETE ? null : athleteId;
