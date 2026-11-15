import type { Bib } from "@/domain/bib";
import type { EventGender } from "@/domain/event";
import {
  beatShare,
  challengeSeason,
  challengeVerdict,
  featuredChallenge,
  type ChallengeLine,
  type ChallengeStanding,
  type ChallengeVerdict,
} from "@/domain/frenchtrack";
import type { Podium } from "@/domain/podium-draft";

import { UseCaseError } from "./errors";

/** A challenge as the signed-in player sees it (the admin sees the podium before the lock). */
export type ChallengeRecord = {
  locked: boolean;
  /** Null before the lock, for a player. */
  podium: Podium | null;
  /** FrenchTrack's points; null until the event is computed. */
  points: number | null;
  /** The player's points once computed; null without a prediction. */
  mine: number | null;
  /** The points of every player once computed, without any name. */
  scores: number[];
};

/** A challenge of the season, for the home card. */
export type ChallengeSummary = {
  eventId: string;
  slug: string;
  discipline: string;
  gender: EventGender;
  startsAt: string;
  lockAt: string;
  points: number | null;
  mine: number | null;
  /** ISO 8601: when its points were first computed; null until then. */
  scoredAt: string | null;
  /** The points of every player once computed, without any name. */
  scores: number[];
};

/** Port: « Battez FrenchTrack » (#674). Real adapter = Supabase, fake = in memory. */
export interface FrenchTrackRepository {
  /** Null when the event is no challenge. */
  challenge(eventId: string): Promise<ChallengeRecord | null>;
  /** The challenges of a season (calendar year, Paris time), in date order. */
  challenges(year: number): Promise<ChallengeSummary[]>;
  /** Every score line of the computed challenges of a season, with the pseudo and bib. */
  season(year: number): Promise<(ChallengeLine & { bib: Bib })[]>;
  /** The admin posts FrenchTrack's podium: the event becomes a challenge. */
  savePick(eventId: string, podium: Podium): Promise<"saved" | "not_admin" | "locked" | "invalid">;
  /** The admin removes the challenge before the lock. */
  removePick(eventId: string): Promise<"removed" | "not_admin" | "locked">;
  /**
   * FrenchTrack's points, stored with the players' when the event is computed; the first
   * computation dates the challenge, a new one keeps that date.
   */
  saveScore(eventId: string, points: number): Promise<"saved" | "not_admin">;
}

const CODES = {
  not_admin: "NOT_ADMIN",
  locked: "FRENCHTRACK_LOCKED",
  invalid: "FRENCHTRACK_PICK_INVALID",
} as const;

/** The admin posts FrenchTrack's podium, three different athletes of the start list. */
export function setFrenchTrackPick(ports: { frenchTrack: FrenchTrackRepository }) {
  return {
    async execute(input: { eventId: string; startList: string[]; podium: Podium }) {
      const picked = [input.podium.first, input.podium.second, input.podium.third];
      if (
        new Set(picked).size !== 3 ||
        picked.some((athleteId) => !input.startList.includes(athleteId))
      ) {
        throw new UseCaseError("FRENCHTRACK_PICK_INVALID");
      }
      const outcome = await ports.frenchTrack.savePick(input.eventId, input.podium);
      if (outcome !== "saved") throw new UseCaseError(CODES[outcome]);
    },
  };
}

export function removeFrenchTrackPick(ports: { frenchTrack: FrenchTrackRepository }) {
  return {
    async execute(input: { eventId: string }) {
      const outcome = await ports.frenchTrack.removePick(input.eventId);
      if (outcome !== "removed") throw new UseCaseError(CODES[outcome]);
    },
  };
}

/** What the challenge card shows; `verdict` and `beaten` once the event is computed. */
export type ChallengeView = ChallengeRecord & {
  verdict: ChallengeVerdict | null;
  beaten: { count: number; percent: number } | null;
};

/** The challenge of an event; null when it is no challenge. */
export function getChallenge(ports: { frenchTrack: FrenchTrackRepository }) {
  return {
    async execute(input: { eventId: string }): Promise<ChallengeView | null> {
      const record = await ports.frenchTrack.challenge(input.eventId);
      if (!record) return null;
      const computed = record.points !== null;
      return {
        ...record,
        verdict: computed ? challengeVerdict(record.mine, record.points!) : null,
        beaten: computed ? beatShare(record.scores, record.points!) : null,
      };
    },
  };
}

/** The challenge of the home: the open one that locks first, else the last one run. */
export function getHomeChallenge(ports: { frenchTrack: FrenchTrackRepository }) {
  return {
    async execute(input: {
      year: number;
      now: Date;
    }): Promise<(ChallengeSummary & { verdict: ChallengeVerdict | null }) | null> {
      const shown = featuredChallenge(await ports.frenchTrack.challenges(input.year), input.now);
      if (!shown) return null;
      return {
        ...shown,
        verdict: shown.points === null ? null : challengeVerdict(shown.mine, shown.points),
      };
    },
  };
}

/** « Qui bat FrenchTrack le plus souvent ? » over a season, with my place (null: not played). */
export function getChallengeSeason(ports: { frenchTrack: FrenchTrackRepository }) {
  return {
    async execute(input: { year: number; userId: string }): Promise<{
      standings: (ChallengeStanding & { bib: Bib })[];
      mine: (ChallengeStanding & { bib: Bib }) | null;
      challenges: number;
    }> {
      const lines = await ports.frenchTrack.season(input.year);
      const bibs = new Map(lines.map((line) => [line.userId, line.bib]));
      const standings = challengeSeason(lines).map((s) => ({ ...s, bib: bibs.get(s.userId)! }));
      return {
        standings,
        mine: standings.find((s) => s.userId === input.userId) ?? null,
        challenges: new Set(lines.map((line) => line.eventId)).size,
      };
    },
  };
}
