import { redirect } from "next/navigation";

import { UseCaseError } from "@/application/errors";
import { getMyPredictionHistory, type MyPredictionLine } from "@/application/list-my-predictions";
import { AccountHero } from "@/components/account/account-hero";
import { ErrorNotice } from "@/components/error-notice";
import { CompetitionChips } from "@/components/events/competition-chips";
import { PredictionLineCard } from "@/components/profile/prediction-history";
import {
  createPublicSupabaseClient,
  createSupabaseEventReader,
  createSupabasePointsRepository,
  createSupabasePredictionRepository,
} from "@/infra";

import { currentCompetition, loadCompetitions } from "../../competition";
import { messages } from "../../messages.fr";
import { paramText } from "../../search-params";
import { getCurrentUser, getSessionClient } from "../../session";

const text = messages.predictionHistory;

/** « Tous mes pronos » (#387): every prediction of one competition, the latest event first. */
export default async function MyPredictionsPage({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string | string[] }>;
}) {
  const asked = paramText((await searchParams).competition);
  const competition = await currentCompetition(asked);
  const here = asked
    ? `/profil/pronos?competition=${encodeURIComponent(competition.slug)}`
    : "/profil/pronos";
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(here)}`);

  const { coming, past } = await loadCompetitions();
  const all = [...coming, ...past].sort((a, b) => b.startsOn.localeCompare(a.startsOn));
  let lines: MyPredictionLine[] | "error";
  try {
    const client = await getSessionClient();
    lines = await getMyPredictionHistory({
      predictions: createSupabasePredictionRepository(client),
      events: createSupabaseEventReader(createPublicSupabaseClient()),
      points: createSupabasePointsRepository(client),
    }).execute({ userId: user.userId, competitionSlugs: [competition.slug] });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    lines = "error";
  }

  return (
    <main id="main" className="flex flex-1 flex-col">
      <AccountHero title={text.title} subtitle={competition.name} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-6">
        {all.length > 1 && (
          <CompetitionChips
            label={text.chooseCompetition}
            chips={all.map((c) => ({
              key: c.slug,
              href: `/profil/pronos?competition=${encodeURIComponent(c.slug)}`,
              name: c.name,
              active: c.slug === competition.slug,
            }))}
          />
        )}
        {lines === "error" ? (
          <ErrorNotice retryHref={here} message={messages.errors.POINTS_UNAVAILABLE} />
        ) : lines.length === 0 ? (
          <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
            {text.emptyCompetition}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lines.map((line) => (
              <li key={line.eventSlug}>
                <PredictionLineCard line={line} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
