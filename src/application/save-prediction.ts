import { isValidPodium, type Podium } from "@/domain/podium-draft";

import { UseCaseError } from "./errors";

export type Prediction = { userId: string; eventId: string; podium: Podium; useJoker: boolean };

/** Why a save did not happen, besides success. The database decides, the use case translates. */
export type SaveOutcome = "saved" | "locked" | "athlete_not_in_event" | "joker_already_used";

/** Port: where predictions are stored. Real adapter = Supabase, fake = in memory. */
export interface PredictionRepository {
  find(userId: string, eventId: string): Promise<Prediction | null>;
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
};

const CODES = {
  locked: "PREDICTION_LOCKED",
  athlete_not_in_event: "ATHLETE_NOT_IN_EVENT",
  joker_already_used: "JOKER_ALREADY_USED",
} as const;

export function savePrediction(ports: { predictions: PredictionRepository }) {
  return {
    async execute(input: SavePredictionInput): Promise<Prediction> {
      const podium: Podium = { first: input.first, second: input.second, third: input.third };
      if (!isValidPodium(podium)) throw new UseCaseError("PODIUM_INVALID");

      const prediction: Prediction = {
        userId: input.userId,
        eventId: input.eventId,
        podium,
        useJoker: input.useJoker,
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
