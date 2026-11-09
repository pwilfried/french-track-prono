// What a player tells about themselves at sign-up (#340), all optional: sex, the disciplines
// they practise, their club. Only the club is shown to other players.
import { isBannedName } from "./banned-names";

export type Sex = "F" | "M";

/** "F", "M", or nothing (the player prefers not to say). */
export function parseSex(input: string): Sex | null | "invalid" {
  if (input === "") return null;
  return input === "F" || input === "M" ? input : "invalid";
}

export type ClubNameResult =
  { ok: true; name: string } | { ok: false; code: "CLUB_NAME_INVALID" | "CLUB_NAME_BANNED" };

/** A club the player types because it is not in the list: 2 to 120 characters, no banned words. */
export function validateClubName(input: string): ClubNameResult {
  const name = input.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 120) return { ok: false, code: "CLUB_NAME_INVALID" };
  if (isBannedName(name)) return { ok: false, code: "CLUB_NAME_BANNED" };
  return { ok: true, name };
}

/** The disciplines once, in the order given, keeping only known ones. */
export function pickDisciplines(chosen: string[], known: string[]): string[] {
  const allowed = new Set(known);
  return [...new Set(chosen)].filter((name) => allowed.has(name));
}
