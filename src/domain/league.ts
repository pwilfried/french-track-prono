/** Invite code alphabet: no 0/O nor 1/I/L, so a code read out loud or typed on a phone is not misread. */
export const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_LENGTH = 6;
export const LEAGUE_NAME_MIN = 2;
export const LEAGUE_NAME_MAX = 40;
/** Decided by the owner (issue #112). */
export const LEAGUE_MAX_MEMBERS = 50;

/**
 * An invite code as typed: spaces and dashes removed, upper case. Returns null when it cannot be a
 * code (wrong length or a character outside the alphabet), so the app can answer without a lookup.
 */
export function normalizeInviteCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, "").toUpperCase();
  if (code.length !== INVITE_LENGTH) return null;
  return [...code].every((c) => INVITE_ALPHABET.includes(c)) ? code : null;
}

/** "K7M2QX" shown as "K7M 2QX", easier to read out loud. */
export function formatInviteCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

export type LeagueNameResult =
  { ok: true; name: string } | { ok: false; code: "LEAGUE_NAME_INVALID" };

/**
 * A league name: trimmed, inner spaces collapsed, 2 to 40 characters; letters (any language),
 * digits, spaces, emoji and simple punctuation; no control characters nor angle brackets.
 */
export function validateLeagueName(input: string): LeagueNameResult {
  const name = input.trim().replace(/\s+/g, " ");
  const length = [...name].length;
  const allowed = /^[\p{L}\p{N}\p{Emoji_Presentation}\p{Extended_Pictographic} '’.,!?&_\-()#+]+$/u;
  if (length < LEAGUE_NAME_MIN || length > LEAGUE_NAME_MAX || !allowed.test(name)) {
    return { ok: false, code: "LEAGUE_NAME_INVALID" };
  }
  return { ok: true, name };
}
