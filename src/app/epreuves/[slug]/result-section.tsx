import { UseCaseError } from "@/application/errors";
import { getMyPoints, type MyEventPoints } from "@/application/get-my-points";
import { getMyPrediction, type Prediction } from "@/application/save-prediction";
import { ErrorNotice } from "@/components/error-notice";
import type { EventDetail } from "@/domain/event";
import { flagOf } from "@/domain/flag";
import { predictionVsOfficial } from "@/domain/podium";
import {
  createSupabasePointsRepository,
  createSupabasePredictionRepository,
  type CurrentUser,
} from "@/infra";

import { currentCompetition } from "../../competition";
import { messages } from "../../messages.fr";
import { pointsReasonLabels } from "../../points-labels";
import { getSessionClient } from "../../session";

async function load(
  userId: string,
  eventId: string,
): Promise<{ mine: Prediction | null; points: MyEventPoints | null } | "error"> {
  const competition = await currentCompetition();
  try {
    const client = await getSessionClient();
    const [mine, points] = await Promise.all([
      getMyPrediction({ predictions: createSupabasePredictionRepository(client) }).execute({
        userId,
        eventId,
      }),
      getMyPoints({ points: createSupabasePointsRepository(client) }).execute({
        userId,
        competitionSlug: competition.slug,
      }),
    ]);
    return { mine, points: points.events.find((e) => e.eventId === eventId) ?? null };
  } catch (error) {
    if (error instanceof UseCaseError) return "error";
    throw error;
  }
}

/** Board 04: my points for this event and my podium against the official one. */
export async function ResultSection({
  event,
  slug,
  user,
}: {
  event: EventDetail;
  slug: string;
  user: CurrentUser;
}) {
  const loaded = await load(user.userId, event.id);
  if (loaded === "error") {
    return (
      <div className="mx-4">
        <ErrorNotice retryHref={`/epreuves/${slug}`} message={messages.errors.POINTS_UNAVAILABLE} />
      </div>
    );
  }
  const { mine, points } = loaded;
  const text = messages.result;
  if (!mine) {
    return <p className="mx-4 rounded-card bg-muted p-4 text-sm">{messages.prediction.none}</p>;
  }

  const entry = new Map(event.entries.map((e) => [e.athleteId, e]));
  const rows = predictionVsOfficial(mine.podium, event.results);
  const labels = points ? pointsReasonLabels(points.reasons) : [];

  return (
    <div className="mx-4 flex flex-col gap-3">
      {points ? (
        <div className="flex items-center gap-3 rounded-card bg-win p-4 text-win-foreground">
          <span aria-hidden="true" className="text-3xl">
            🎯
          </span>
          <div>
            <p className="font-mono text-3xl font-bold">{text.points(points.points)}</p>
            <p className="text-sm">{labels.map((l) => l.text).join(" · ")}</p>
          </div>
        </div>
      ) : (
        <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
          {text.notComputed}
        </p>
      )}

      <section className="rounded-card border border-border bg-card p-4">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {text.vsTitle}
        </h2>
        <ol className="flex flex-col gap-2">
          {rows.map((row) => {
            const athlete = entry.get(row.athleteId);
            return (
              <li key={row.slot} className="flex items-center gap-2 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-gold-soft text-xs font-bold text-gold-ink">
                  {row.slot}
                </span>
                <span aria-hidden="true">{athlete ? flagOf(athlete.countryCode) : null}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {athlete?.name ?? "?"}
                </span>
                <span
                  className={`font-mono text-xs font-bold ${
                    row.outcome === "off" ? "text-muted-foreground" : "text-success-text"
                  }`}
                >
                  {text.outcome[row.outcome]}
                </span>
              </li>
            );
          })}
        </ol>
        {points && (
          <p className="mt-3 flex items-center justify-between border-t border-border pt-2 font-bold">
            <span>{text.total}</span>
            <span className="font-mono text-success-text">{text.totalPoints(points.points)}</span>
          </p>
        )}
      </section>
    </div>
  );
}
