/** What the shared season card shows (#388): public figures only, never e-mail, sex or disciplines. */
export type SeasonCard = {
  pseudo: string;
  avatar: string;
  /** The club when validated by the admin (public on the player card), else null. */
  club: string | null;
  points: number;
  /** Null before the first point. */
  rank: number | null;
  players: number;
  best: { discipline: string; gender: "F" | "M" | "X"; points: number; perfect: boolean } | null;
};

/**
 * Picks the card's fields from the profile, the player details and the season. Only the listed
 * fields are copied, so anything private passed along never reaches the image.
 */
export function seasonCardOf(input: {
  profile: { pseudo: string; avatar: string };
  club: { name: string; validated: boolean } | null;
  season: {
    points: number;
    rank: number | null;
    players: number;
    bestShot: SeasonCard["best"] | null;
  };
}): SeasonCard {
  const best = input.season.bestShot;
  return {
    pseudo: input.profile.pseudo,
    avatar: input.profile.avatar,
    club: input.club?.validated ? input.club.name : null,
    points: input.season.points,
    rank: input.season.rank,
    players: input.season.players,
    best: best
      ? {
          discipline: best.discipline,
          gender: best.gender,
          points: best.points,
          perfect: best.perfect,
        }
      : null,
  };
}
