import { UseCaseError } from "@/application/errors";
import { listEvents } from "@/application/list-events";
import { ClubNotices } from "@/components/account/club-notices";
import { CompleteProfileCard } from "@/components/home/complete-profile-card";
import { PlayerHome } from "@/components/home/player-home";
import { VisitorHome } from "@/components/home/visitor-home";
import { daysUntil } from "@/domain/competition";
import { firstFinalToPredict } from "@/domain/home";

import { findClubsAction } from "./club-actions";
import { completeProfileAction, completeProfileLaterAction } from "./complete-profile-actions";
import {
  currentCompetition,
  currentDay,
  loadCompetitions,
  type ShownCompetition,
} from "./competition";
import { loadPlayerHome } from "./home-data";
import { loadScale } from "./scale";
import { getCurrentUser } from "./session";
import { publicEventReader } from "./public-data";

/** The points « Comment ça marche » reads from the scale. */
function stepPoints(scale: Record<string, number>) {
  const exact = scale.exact_slot ?? 0;
  return { exactPoints: exact, perfectPoints: 3 * exact + (scale.perfect_podium ?? 0) };
}

/**
 * The visitor's home (#439): the sign-in, then the first open final of the next competition; the
 * card shows that competition while it is to come or has finals still open.
 */
async function Visitor({ coming, today }: { coming: ShownCompetition[]; today: string }) {
  const competition = await currentCompetition();
  const [scale, events] = await Promise.all([
    loadScale(),
    listEvents({ events: publicEventReader() })
      .execute({ competitionSlug: competition.slug })
      .catch((error: unknown) => {
        if (error instanceof UseCaseError) return [];
        throw error;
      }),
  ]);
  const final = firstFinalToPredict(events, new Date());
  const shown = final || coming.some((c) => c.slug === competition.slug) ? competition : null;

  return (
    <VisitorHome
      playHref={
        final ? `/connexion?next=${encodeURIComponent(`/epreuves/${final}`)}` : "/connexion"
      }
      {...stepPoints(scale)}
      competition={
        shown && {
          slug: shown.slug,
          scope: shown.scope,
          venue: shown.venue,
          name: shown.name,
          place: shown.place,
          finals: shown.finals,
          daysLeft: Math.max(0, daysUntil(shown.startsOn, today)),
        }
      }
    />
  );
}

/**
 * Home: a running track behind (#346). A signed-in player sees the one thing to do next, then their
 * league, their last result, the Manager and FrenchTrack (#526); a visitor sees how to play and one
 * button to a first prediction (#439).
 */
export default async function Home() {
  const today = currentDay();
  const now = new Date();
  const user = await getCurrentUser();
  const [{ coming }, player, scale] = await Promise.all([
    loadCompetitions(),
    user ? loadPlayerHome(user.userId, now) : Promise.resolve(null),
    loadScale(),
  ]);

  if (!user || !player) {
    return (
      <main id="main" className="flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-md flex-col px-4 py-6">
          <Visitor coming={coming} today={today} />
        </div>
      </main>
    );
  }

  const { clubNotices, completeProfile, ...home } = player;
  return (
    <main id="main" className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
        <ClubNotices notices={clubNotices} />
        <PlayerHome
          userId={user.userId}
          now={now}
          {...stepPoints(scale)}
          {...home}
          completeProfile={
            completeProfile ? (
              <CompleteProfileCard
                firstPodium={completeProfile.firstPodium}
                search={findClubsAction}
                save={completeProfileAction}
                later={completeProfileLaterAction}
              />
            ) : null
          }
        />
      </div>
    </main>
  );
}
