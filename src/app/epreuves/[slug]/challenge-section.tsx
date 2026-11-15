import { UseCaseError } from "@/application/errors";
import { getChallenge } from "@/application/frenchtrack";
import { getMyPrediction } from "@/application/save-prediction";
import { ChallengeCard } from "@/components/challenge/challenge-card";
import type { EventDetail } from "@/domain/event";
import {
  createSupabaseFrenchTrackRepository,
  createSupabasePredictionRepository,
  type CurrentUser,
} from "@/infra";

import { messages } from "../../messages.fr";
import { getSessionClient } from "../../session";

/** « Battez FrenchTrack » (#674) on a challenge; nothing on another event or when unreadable. */
export async function ChallengeSection({
  event,
  slug,
  user,
}: {
  event: EventDetail;
  slug: string;
  user: CurrentUser;
}) {
  const client = await getSessionClient();
  let loaded;
  try {
    const view = await getChallenge({
      frenchTrack: createSupabaseFrenchTrackRepository(client),
    }).execute({ eventId: event.id });
    if (!view) return null;
    const mine = view.locked
      ? await getMyPrediction({ predictions: createSupabasePredictionRepository(client) }).execute({
          userId: user.userId,
          eventId: event.id,
        })
      : null;
    loaded = { view, mine };
  } catch (error) {
    // The challenge only adds to the page: it never keeps the prediction from showing.
    if (error instanceof UseCaseError) return null;
    throw error;
  }
  return (
    <div className="mx-4">
      <ChallengeCard
        slug={slug}
        eventName={messages.events.name(event.discipline, event.gender)}
        view={loaded.view}
        myPodium={loaded.mine?.podium ?? null}
        athletes={new Map(event.entries.map((e) => [e.athleteId, e]))}
      />
    </div>
  );
}
