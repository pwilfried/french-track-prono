import type { Bib } from "./bib";

/**
 * How the members of a league react to its moments (#672), with no free text (non-goal 6): an
 * emoji from a fixed list, one of each per player, and one preset message per player and moment.
 * Codes only: src/app/messages.fr.ts writes the emojis and the sentences. The database checks the
 * same lists (supabase/migrations/20261115030000_moment_reactions.sql).
 */
export const MOMENT_EMOJIS = ["fire", "clap", "wow", "laugh"] as const;
export type MomentEmoji = (typeof MOMENT_EMOJIS)[number];

export const PRESET_MESSAGES = [
  "well_played",
  "what_flair",
  "rematch",
  "bad_luck",
  "catching_up",
] as const;
export type PresetMessage = (typeof PRESET_MESSAGES)[number];

export const isMomentEmoji = (value: string): value is MomentEmoji =>
  (MOMENT_EMOJIS as readonly string[]).includes(value);

export const isPresetMessage = (value: string): value is PresetMessage =>
  (PRESET_MESSAGES as readonly string[]).includes(value);

/** One reaction or message of a league's feed, as a member reads it. */
export type MomentResponse = {
  id: string;
  /** The moment it answers, by its key in the league. */
  momentKey: string;
  kind: "emoji" | "message";
  code: string;
  /** Who sent it: their pseudo and bib, nothing else (decision of 14 Nov 2026). */
  pseudo: string;
  bib?: Bib;
  mine: boolean;
  /** I reported it already. */
  reported: boolean;
};

export type ShownMessage = {
  id: string;
  code: PresetMessage;
  pseudo: string;
  bib?: Bib;
  mine: boolean;
  reported: boolean;
};

/** What one moment shows under it. */
export type MomentReactions = {
  emojis: { code: MomentEmoji; count: number; mine: boolean }[];
  messages: ShownMessage[];
  /** The preset message I sent, if any. */
  myMessage: PresetMessage | null;
};

/** A moment nobody reacted to yet. */
export const NO_REACTIONS: MomentReactions = {
  emojis: MOMENT_EMOJIS.map((code) => ({ code, count: 0, mine: false })),
  messages: [],
  myMessage: null,
};

/**
 * What each moment shows, by moment key: every emoji with its count (fixed order), and the preset
 * messages in the order received. A code out of the lists is left out.
 */
export function momentReactions(responses: MomentResponse[]): Record<string, MomentReactions> {
  const shown: Record<string, MomentReactions> = {};
  for (const r of responses) {
    const moment = (shown[r.momentKey] ??= {
      emojis: NO_REACTIONS.emojis.map((e) => ({ ...e })),
      messages: [],
      myMessage: null,
    });
    if (r.kind === "emoji" && isMomentEmoji(r.code)) {
      const emoji = moment.emojis.find((e) => e.code === r.code)!;
      emoji.count += 1;
      emoji.mine ||= r.mine;
    } else if (r.kind === "message" && isPresetMessage(r.code)) {
      moment.messages.push({
        id: r.id,
        code: r.code,
        pseudo: r.pseudo,
        ...(r.bib ? { bib: r.bib } : {}),
        mine: r.mine,
        reported: r.reported,
      });
      if (r.mine) moment.myMessage = r.code;
    }
  }
  return shown;
}
