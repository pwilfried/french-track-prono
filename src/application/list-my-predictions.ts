import type { Prediction, PredictionRepository } from "./save-prediction";

export function listMyPredictions(ports: { predictions: PredictionRepository }) {
  return {
    async execute(input: { userId: string; competitionSlug: string }): Promise<Prediction[]> {
      return ports.predictions.listForCompetition(input.userId, input.competitionSlug);
    },
  };
}
