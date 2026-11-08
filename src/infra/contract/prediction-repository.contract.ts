import { describe, expect, it } from "vitest";

import type { Prediction, PredictionRepository } from "@/application/save-prediction";
import { OTHER_ATHLETE } from "@/domain/podium-draft";

export type Player = { userId: string; predictions: PredictionRepository };

/** An event the contract can use: its start list, and one athlete who is not on it. */
export type EventFixture = { eventId: string; athleteIds: string[]; outsiderId: string };

export type PredictionWorld = {
  competitionSlug: string;
  newPlayer(): Promise<Player>;
  /** At least two events still open, in the same competition. */
  openEvents: EventFixture[];
  /** An event already locked. */
  lockedEvent: EventFixture;
  /** A semi-final still open: rounds before the final are never predicted. */
  semiFinal: EventFixture;
};

/**
 * Contract of the PredictionRepository port, run against the in-memory fake AND the real Supabase
 * adapter. The real one needs open events: run `npm run db:open-events` first.
 */
export function predictionRepositoryContract(name: string, world: () => Promise<PredictionWorld>) {
  const prediction = (player: Player, event: EventFixture, useJoker = false): Prediction => ({
    userId: player.userId,
    eventId: event.eventId,
    podium: {
      first: event.athleteIds[0]!,
      second: event.athleteIds[1]!,
      third: event.athleteIds[2]!,
    },
    useJoker,
  });

  describe(`PredictionRepository contract: ${name}`, () => {
    it("finds nothing for an event the player has not predicted", async () => {
      const w = await world();
      const player = await w.newPlayer();

      expect(await player.predictions.find(player.userId, w.openEvents[0]!.eventId)).toBeNull();
    });

    it("saves a prediction and finds it again", async () => {
      const w = await world();
      const player = await w.newPlayer();
      const wanted = prediction(player, w.openEvents[0]!, true);

      expect(await player.predictions.save(wanted)).toBe("saved");

      expect(await player.predictions.find(player.userId, wanted.eventId)).toEqual(wanted);
    });

    it("refuses « autre athlète » on an event played without odds", async () => {
      const w = await world();
      const player = await w.newPlayer();
      const event = w.openEvents[0]!;
      const withOther: Prediction = {
        ...prediction(player, event),
        podium: { first: event.athleteIds[0]!, second: OTHER_ATHLETE, third: event.athleteIds[1]! },
      };

      expect(await player.predictions.save(withOther)).toBe("athlete_not_proposed");
      expect(await player.predictions.find(player.userId, event.eventId)).toBeNull();
    });

    it("replaces the previous prediction when the player saves again", async () => {
      const w = await world();
      const player = await w.newPlayer();
      const event = w.openEvents[0]!;
      await player.predictions.save(prediction(player, event));
      const changed: Prediction = {
        ...prediction(player, event),
        podium: {
          first: event.athleteIds[2]!,
          second: event.athleteIds[1]!,
          third: event.athleteIds[0]!,
        },
      };

      expect(await player.predictions.save(changed)).toBe("saved");

      expect(await player.predictions.find(player.userId, event.eventId)).toEqual(changed);
    });

    it("lists only the player's own predictions of the competition, with the joker flag", async () => {
      const w = await world();
      const player = await w.newPlayer();
      const other = await w.newPlayer();
      await player.predictions.save(prediction(player, w.openEvents[0]!, true));
      await player.predictions.save(prediction(player, w.openEvents[1]!));
      await other.predictions.save(prediction(other, w.openEvents[0]!));

      const mine = await player.predictions.listForCompetition(player.userId, w.competitionSlug);

      expect(mine.map((p) => [p.eventId, p.useJoker]).sort()).toEqual(
        [
          [w.openEvents[0]!.eventId, true],
          [w.openEvents[1]!.eventId, false],
        ].sort(),
      );
    });

    it("refuses a prediction on a locked event", async () => {
      const w = await world();
      const player = await w.newPlayer();

      expect(await player.predictions.save(prediction(player, w.lockedEvent))).toBe("locked");
    });

    it("refuses an athlete who is not on the start list", async () => {
      const w = await world();
      const player = await w.newPlayer();
      const event = w.openEvents[0]!;
      const wanted = prediction(player, event);
      wanted.podium.second = event.outsiderId;

      expect(await player.predictions.save(wanted)).toBe("athlete_not_in_event");
    });

    it("refuses a second joker in the same competition", async () => {
      const w = await world();
      const player = await w.newPlayer();
      await player.predictions.save(prediction(player, w.openEvents[0]!, true));

      expect(await player.predictions.save(prediction(player, w.openEvents[1]!, true))).toBe(
        "joker_already_used",
      );
    });

    it("lets the player move the joker to the same event again", async () => {
      const w = await world();
      const player = await w.newPlayer();
      const event = w.openEvents[0]!;
      await player.predictions.save(prediction(player, event, true));

      expect(await player.predictions.save(prediction(player, event, true))).toBe("saved");
    });

    it("refuses a round before the final as not open yet", async () => {
      const w = await world();
      const player = await w.newPlayer();

      expect(await player.predictions.save(prediction(player, w.semiFinal))).toBe(
        "round_not_ready",
      );
      expect(await player.predictions.find(player.userId, w.semiFinal.eventId)).toBeNull();
    });
  });
}
