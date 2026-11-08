import { parseMark, type MarkUnit } from "@/domain/discipline";
import { isValidPodium, OTHER_ATHLETE, type Podium, type PodiumMarks } from "@/domain/podium-draft";

import { UseCaseError } from "./errors";

export type Prediction = {
  userId: string;
  eventId: string;
  podium: Podium;
  useJoker: boolean;
  /** Present when the player predicted at least one mark. */
  marks?: PodiumMarks;
};

/** Why a save did not happen, besides success. The database decides, the use case translates. */
export type SaveOutcome =
  | "saved"
  | "locked"
  | "round_not_ready"
  | "athlete_not_in_event"
  | "athlete_not_proposed"
  | "joker_already_used";

/** Port: where predictions are stored. Real adapter = Supabase, fake = in memory. */
export interface PredictionRepository {
  find(userId: string, eventId: string): Promise<Prediction | null>;
  /** The player's own predictions for the events of one competition. */
  listForCompetition(userId: string, competitionSlug: string): Promise<Prediction[]>;
  /** Creates the prediction or replaces the player's previous one for this event. */
  save(prediction: Prediction): Promise<SaveOutcome>;
}

export type SavePredictionInput = {
  userId: string;
  eventId: string;
  first: string;
  second: string;
  third: string;
  useJoker: boolean;
  /** Marks as typed ("" for none), for the athletes of the podium. */
  marks?: { first: string; second: string; third: string };
  /** How the event's discipline measures a mark; needed when a mark is typed. */
  markUnit?: MarkUnit;
};

const SLOTS = ["first", "second", "third"] as const;

/** The typed marks as numbers; null when none is typed; "invalid" when one cannot be read. */
function readMarks(input: SavePredictionInput, podium: Podium): PodiumMarks | null | "invalid" {
  const typed = SLOTS.map((slot) => [slot, (input.marks?.[slot] ?? "").trim()] as const);
  if (typed.every(([, text]) => text === "")) return null;
  const marks: PodiumMarks = { first: null, second: null, third: null };
  for (const [slot, text] of typed) {
    if (text === "") continue;
    // « Autre athlète » is nobody in particular: no mark to predict.
    if (!input.markUnit || podium[slot] === OTHER_ATHLETE) return "invalid";
    const value = parseMark(text, input.markUnit);
    if (value === null || value <= 0) return "invalid";
    marks[slot] = value;
  }
  return marks;
}

const CODES = {
  locked: "PREDICTION_LOCKED",
  round_not_ready: "ROUND_NOT_READY",
  athlete_not_in_event: "ATHLETE_NOT_IN_EVENT",
  athlete_not_proposed: "ATHLETE_NOT_PROPOSED",
  joker_already_used: "JOKER_ALREADY_USED",
} as const;

export function savePrediction(ports: { predictions: PredictionRepository }) {
  return {
    async execute(input: SavePredictionInput): Promise<Prediction> {
      const podium: Podium = { first: input.first, second: input.second, third: input.third };
      if (!isValidPodium(podium)) throw new UseCaseError("PODIUM_INVALID");
      const marks = readMarks(input, podium);
      if (marks === "invalid") throw new UseCaseError("MARK_INVALID");

      const prediction: Prediction = {
        userId: input.userId,
        eventId: input.eventId,
        podium,
        useJoker: input.useJoker,
        ...(marks ? { marks } : {}),
      };
      const outcome = await ports.predictions.save(prediction);
      if (outcome !== "saved") throw new UseCaseError(CODES[outcome]);
      return prediction;
    },
  };
}

export function getMyPrediction(ports: { predictions: PredictionRepository }) {
  return {
    async execute(input: { userId: string; eventId: string }): Promise<Prediction | null> {
      return ports.predictions.find(input.userId, input.eventId);
    },
  };
}
