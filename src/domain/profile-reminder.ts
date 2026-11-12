// The home asks a player whose profile is incomplete to complete it (#540): a club, or the
// families of disciplines they practise. « Plus tard » hides the card for 30 days.
import type { Discipline, DisciplineFamily } from "./discipline";

/** The families a player ticks on the home, wider than the discipline families (no relay). */
export type ProfileFamily =
  "sprint" | "hurdles" | "middle_distance" | "jumps" | "throws" | "combined";

/** Six families, in the order shown, each with the discipline families it covers. */
export const PROFILE_FAMILIES: { family: ProfileFamily; covers: DisciplineFamily[] }[] = [
  { family: "sprint", covers: ["sprint"] },
  { family: "hurdles", covers: ["hurdles"] },
  { family: "middle_distance", covers: ["middle", "long"] },
  { family: "jumps", covers: ["horizontal_jumps", "vertical_jumps"] },
  { family: "throws", covers: ["throws"] },
  { family: "combined", covers: ["combined"] },
];

/** How long « Plus tard » hides the card. */
export const COMPLETE_LATER_DAYS = 30;

/** Incomplete: neither a club nor a discipline. */
export function isProfileIncomplete(profile: { hasClub: boolean; disciplines: string[] }): boolean {
  return !profile.hasClub && profile.disciplines.length === 0;
}

/** Until when « Plus tard », pressed now, hides the card. */
export function completeLaterUntil(now: Date): Date {
  return new Date(now.getTime() + COMPLETE_LATER_DAYS * 24 * 60 * 60 * 1000);
}

/** The card shows for an incomplete profile, unless « Plus tard » still hides it. */
export function shouldAskToCompleteProfile(
  profile: { hasClub: boolean; disciplines: string[]; hiddenUntil: Date | null },
  now: Date,
): boolean {
  if (!isProfileIncomplete(profile)) return false;
  return profile.hiddenUntil === null || profile.hiddenUntil.getTime() <= now.getTime();
}

/** Every discipline of the chosen families, in the order known; unknown families are ignored. */
export function disciplinesOfFamilies(
  families: string[],
  known: Pick<Discipline, "name" | "family">[],
): string[] {
  const covered = new Set(
    PROFILE_FAMILIES.filter((f) => families.includes(f.family)).flatMap((f) => f.covers),
  );
  return known.filter((d) => covered.has(d.family)).map((d) => d.name);
}
