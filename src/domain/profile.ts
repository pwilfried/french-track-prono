import { isBannedName } from "./banned-names";

export type PseudoResult =
  { ok: true; pseudo: string } | { ok: false; code: "PSEUDO_INVALID" | "PSEUDO_BANNED" };

const MIN_LENGTH = 2;
const MAX_LENGTH = 24;
// Letters (with accents), digits, space, underscore, hyphen and dot.
const ALLOWED = /^[\p{L}\p{N} _.-]+$/u;

/** Cleans a pseudo (trim, repeated spaces collapsed, accents composed) and checks the rules. */
export function validatePseudo(input: string): PseudoResult {
  const pseudo = input.normalize("NFC").replace(/ {2,}/g, " ").trim();
  const length = [...pseudo].length; // characters, not UTF-16 units: same as the database check
  if (length < MIN_LENGTH || length > MAX_LENGTH || !ALLOWED.test(pseudo)) {
    return { ok: false, code: "PSEUDO_INVALID" };
  }
  // Seen by every player: the same banned words as public leagues (#344).
  if (isBannedName(pseudo)) return { ok: false, code: "PSEUDO_BANNED" };
  return { ok: true, pseudo };
}

/** Avatars a player can choose from: a fixed list, so they render the same everywhere. */
export const AVATARS = [
  "🏃",
  "⚡",
  "🔥",
  "🚀",
  "🐆",
  "🦅",
  "🐢",
  "🦊",
  "🏅",
  "🥇",
  "🎯",
  "🍀",
] as const;

export type Avatar = (typeof AVATARS)[number];

/** Same as the default of `profiles.avatar_emoji` in the database. */
export const DEFAULT_AVATAR: Avatar = "🏃";

export function isAvatar(value: string): value is Avatar {
  return (AVATARS as readonly string[]).includes(value);
}
