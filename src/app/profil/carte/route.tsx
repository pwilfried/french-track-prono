import { UseCaseError } from "@/application/errors";
import { getMySeason } from "@/application/get-my-season";
import { getProfile } from "@/application/get-profile";
import { getPlayerDetails } from "@/application/player-details";
import { seasonCardOf } from "@/domain/season-card";
import {
  createSupabasePlayerDetailsRepository,
  createSupabasePredictionRepository,
  createSupabaseProfileRepository,
} from "@/infra";

import { seasonCompetitionSlugs } from "../../competition";
import { getCurrentUser, getSessionClient } from "../../session";
import { publicEventReader, publicDisciplines, publicRanking } from "../../public-data";
import { seasonCardImage } from "./season-card-image";

/** « Ma carte de saison » (#388): the signed-in player's season as a story image (1080 × 1920). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  const client = await getSessionClient();
  const profile = await getProfile({
    profiles: createSupabaseProfileRepository(client),
  }).execute({ userId: user.userId });
  if (!profile) return new Response(null, { status: 404 });

  const slugs = await seasonCompetitionSlugs();
  let card;
  try {
    const [season, details] = await Promise.all([
      getMySeason({
        ranking: publicRanking(),
        predictions: createSupabasePredictionRepository(client),
        events: publicEventReader(),
        disciplines: publicDisciplines(),
      }).execute({
        userId: user.userId,
        competitionSlugs: slugs,
      }),
      getPlayerDetails({ details: createSupabasePlayerDetailsRepository(client) }).execute({
        userId: user.userId,
      }),
    ]);
    card = seasonCardOf({
      profile,
      club: details.club,
      season: { ...season, bestShot: season.stats.bestShot, animal: season.animal },
    });
  } catch (error) {
    if (error instanceof UseCaseError) return new Response(null, { status: 503 });
    throw error;
  }

  return seasonCardImage(card);
}
