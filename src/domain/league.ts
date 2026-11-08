/** Invite code alphabet: no 0/O nor 1/I/L, so a code read out loud or typed on a phone is not misread. */
export const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_LENGTH = 6;
export const LEAGUE_NAME_MIN = 2;
export const LEAGUE_NAME_MAX = 40;
/** Decided by the owner (issue #112). */
export const LEAGUE_MAX_MEMBERS = 50;
/** A public league, joined without a code (issue #277). */
export const PUBLIC_LEAGUE_MAX_MEMBERS = 200;

/** How many players a league can hold. */
export const leagueCapacity = (isPublic: boolean) =>
  isPublic ? PUBLIC_LEAGUE_MAX_MEMBERS : LEAGUE_MAX_MEMBERS;

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

/**
 * Words a public league name may not contain (moderation decided by the owner, #277): common
 * insults, names that would look official, and links. Whole words; stems also cover their
 * endings ("officielle", "enculés"). The database keeps the same list (is_banned_league_name).
 */
const BANNED_WORDS = [
  "con",
  "cons",
  "pd",
  "fdp",
  "ntm",
  "ffa",
  "www",
  "http",
  "https",
  "pute",
  "putes",
];
const BANNED_STEMS = ["officiel", "connard", "encul", "salop", "merde", "niqu", "batard"];
const LINK = /[a-z0-9-]+\.(com|fr|net|org|io|be|ch|info|bet)\b/;

/** True when a public league name contains a banned word, whatever its case, accents or spacing. */
export function isBannedLeagueName(input: string): boolean {
  const plain = input.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (LINK.test(plain)) return true;
  // Letters typed apart ("F F A") are read as one word.
  const words = plain
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .reduce<string[]>((acc, token, i, all) => {
      const glued = token.length === 1 && i > 0 && all[i - 1]!.length === 1;
      if (glued) acc[acc.length - 1] += token;
      else acc.push(token);
      return acc;
    }, []);
  return words.some(
    (w) => BANNED_WORDS.includes(w) || BANNED_STEMS.some((stem) => w.startsWith(stem)),
  );
}
