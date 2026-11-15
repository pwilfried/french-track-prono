import type { MomentKind } from "@/domain/league-moments";
import {
  isMomentEmoji,
  isPresetMessage,
  momentReactions,
  type MomentEmoji,
  type MomentReactions,
  type MomentResponse,
  type PresetMessage,
} from "@/domain/moment-reactions";

import { UseCaseError } from "./errors";

/** A reported reaction or message, as the admin sees it in the back-office. */
export type MomentReport = {
  id: string;
  kind: "emoji" | "message";
  code: string;
  /** Who sent it. */
  pseudo: string;
  leagueId: string;
  leagueName: string;
  momentKind: MomentKind;
  /** How many players reported it. */
  reports: number;
  /** ISO 8601. */
  lastReportedAt: string;
};

type Outcome = "done" | "refused";
type AdminOutcome = "done" | "not_admin" | "unknown";

/**
 * Port: the reactions to the moments of the leagues (#672). Real adapter = Supabase (the database
 * checks the member, the lists and the admin), fake = in memory.
 */
export interface MomentReactionRepository {
  /** Every reaction and message of a league's feed I may read; none outside the league. */
  list(leagueId: string): Promise<MomentResponse[]>;
  /** `refused` when I am not a member of the league, or the moment is unknown. */
  addEmoji(leagueId: string, momentKey: string, emoji: MomentEmoji): Promise<Outcome>;
  removeEmoji(leagueId: string, momentKey: string, emoji: MomentEmoji): Promise<Outcome>;
  /** Sends my preset message under the moment; it replaces the one I sent before. */
  sendMessage(leagueId: string, momentKey: string, message: PresetMessage): Promise<Outcome>;
  /** Reports a reaction or a message; twice changes nothing. */
  report(reactionId: string): Promise<"done" | "unknown">;
  /** The reported items still shown, the most reported first. Admin only. */
  reports(): Promise<MomentReport[] | "not_admin">;
  /** Hides an item for everyone. Admin only. */
  hide(reactionId: string): Promise<AdminOutcome>;
  /** The reports were unfounded: the item stays. Admin only. */
  dismiss(reactionId: string): Promise<AdminOutcome>;
}

type Ports = { reactions: MomentReactionRepository };
type MomentInput = { leagueId: string; momentKey: string };

const refused = (outcome: Outcome) => {
  if (outcome === "refused") throw new UseCaseError("MOMENT_REACTION_REFUSED");
};

const handled = (outcome: AdminOutcome) => {
  if (outcome === "not_admin") throw new UseCaseError("NOT_ADMIN");
  if (outcome === "unknown") throw new UseCaseError("REACTION_UNKNOWN");
};

/** What each moment of a league shows under it, by moment key. */
export function getMomentReactions(ports: Ports) {
  return {
    async execute(input: { leagueId: string }): Promise<Record<string, MomentReactions>> {
      return momentReactions(await ports.reactions.list(input.leagueId));
    },
  };
}

/** Adds (`on`) or removes one of the four emojis on a moment of my league. */
export function reactToMoment(ports: Ports) {
  return {
    async execute(input: MomentInput & { emoji: string; on: boolean }): Promise<void> {
      if (!isMomentEmoji(input.emoji)) throw new UseCaseError("INVALID_REACTION");
      const { leagueId, momentKey, emoji } = input;
      refused(
        await (input.on
          ? ports.reactions.addEmoji(leagueId, momentKey, emoji)
          : ports.reactions.removeEmoji(leagueId, momentKey, emoji)),
      );
    },
  };
}

/** Sends one of the preset messages under a moment of my league, replacing mine. */
export function sendPresetMessage(ports: Ports) {
  return {
    async execute(input: MomentInput & { message: string }): Promise<void> {
      if (!isPresetMessage(input.message)) throw new UseCaseError("INVALID_REACTION");
      refused(await ports.reactions.sendMessage(input.leagueId, input.momentKey, input.message));
    },
  };
}

/** Reports a reaction or a message to the admin. */
export function reportMomentReaction(ports: Ports) {
  return {
    async execute(input: { reactionId: string }): Promise<void> {
      if ((await ports.reactions.report(input.reactionId)) === "unknown")
        throw new UseCaseError("REACTION_UNKNOWN");
    },
  };
}

export function listMomentReports(ports: Ports) {
  return {
    async execute(): Promise<MomentReport[]> {
      const reports = await ports.reactions.reports();
      if (reports === "not_admin") throw new UseCaseError("NOT_ADMIN");
      return reports;
    },
  };
}

export function hideMomentReaction(ports: Ports) {
  return {
    async execute(input: { reactionId: string }): Promise<void> {
      handled(await ports.reactions.hide(input.reactionId));
    },
  };
}

export function dismissMomentReports(ports: Ports) {
  return {
    async execute(input: { reactionId: string }): Promise<void> {
      handled(await ports.reactions.dismiss(input.reactionId));
    },
  };
}
