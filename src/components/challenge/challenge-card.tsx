import Link from "next/link";

import type { ChallengeView } from "@/application/frenchtrack";
import { messages } from "@/app/messages.fr";
import { CountryFlag } from "@/components/athletes/country-flag";
import type { Podium } from "@/domain/podium-draft";
import { cn } from "@/lib/utils";

import { ShareChallenge } from "./share-challenge";

const text = messages.challenge;
const PLACES = ["first", "second", "third"] as const;

/** On the night blue of FrenchTrack, the same in both themes (AA). */
const challengeCard =
  "flex flex-col gap-3 rounded-card border border-white/15 bg-nuit p-4 text-white";

type Athlete = { name: string; countryCode: string };

function PodiumColumn({
  who,
  label,
  podium,
  points,
  athletes,
  best,
}: {
  who: string;
  label: string;
  podium: Podium | null;
  points: number | null;
  athletes: Map<string, Athlete>;
  best: boolean;
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-2xl p-2.5",
        best ? "bg-white text-nuit" : "bg-white/10",
      )}
    >
      <p className="flex items-baseline justify-between gap-1">
        <span className="min-w-0 truncate text-sm font-extrabold">{who}</span>
        {points !== null && (
          <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
            {text.points(points)}
          </span>
        )}
      </p>
      {podium ? (
        <ol className="flex flex-col gap-1">
          {PLACES.map((place, index) => {
            const athlete = athletes.get(podium[place]);
            return (
              <li key={place} className="flex min-w-0 items-center gap-1.5 text-[13px]">
                <span className="font-mono text-xs font-bold">{index + 1}</span>
                <span aria-hidden="true">
                  {athlete && <CountryFlag code={athlete.countryCode} />}
                </span>
                <span className="min-w-0 break-words font-semibold leading-tight">
                  {athlete?.name ?? "?"}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-[13px]">{text.noPodium}</p>
      )}
    </section>
  );
}

/**
 * « Battez FrenchTrack » on an event (#674): before the lock, FrenchTrack's podium is posted but
 * hidden; after the lock, it is shown; after the result, both podiums side by side with their
 * points, the verdict, the share of players who beat FrenchTrack and the share button.
 */
export function ChallengeCard({
  slug,
  eventName,
  view,
  myPodium,
  athletes,
}: {
  slug: string;
  eventName: string;
  view: ChallengeView;
  myPodium: Podium | null;
  athletes: Map<string, Athlete>;
}) {
  const { verdict } = view;
  return (
    <section aria-labelledby="challenge-title" data-challenge className={challengeCard}>
      <h2 id="challenge-title" className="font-display text-xl font-extrabold">
        {text.title}
      </h2>
      {!view.locked ? (
        <p className="text-sm text-[#d9e4f5]">
          {text.open} {text.hidden}
        </p>
      ) : (
        <>
          {verdict ? (
            <p data-verdict className="font-display text-2xl font-extrabold leading-tight">
              {text.verdict[verdict]}
            </p>
          ) : (
            <p className="text-sm text-[#d9e4f5]">{text.waiting}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <PodiumColumn
              who={text.you}
              label={text.yourPodium}
              podium={myPodium}
              points={view.points === null ? null : view.mine}
              athletes={athletes}
              best={verdict === "won"}
            />
            <PodiumColumn
              who={text.frenchTrack}
              label={text.frenchTrackPodium}
              podium={view.podium}
              points={view.points}
              athletes={athletes}
              best={verdict === "lost" || verdict === "no_prediction"}
            />
          </div>
          {view.beaten && (
            <p className="text-sm text-[#d9e4f5]">{text.beaten(view.beaten.percent)}</p>
          )}
          {verdict && verdict !== "no_prediction" && (
            <ShareChallenge slug={slug} verdict={verdict} eventName={eventName} />
          )}
        </>
      )}
      <Link
        href="/classement/frenchtrack"
        className="inline-flex min-h-11 items-center self-start text-sm font-bold underline underline-offset-4"
      >
        {text.seasonLink}
      </Link>
    </section>
  );
}
