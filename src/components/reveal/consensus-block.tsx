import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { buttonVariants } from "@/components/ui/button";
import type { Consensus, Place, PlaceShare } from "@/domain/consensus";

const PLACES: readonly Place[] = ["first", "second", "third"];
const RANK: Record<Place, number> = { first: 1, second: 2, third: 3 };
const SHOWN = 3;

type Row = { key: string; name: string; percent: number; mine: boolean; found: boolean };

/** The three most picked athletes of a place, then everyone else together; mine always shown. */
function rowsOf(
  shares: PlaceShare[],
  nameOf: (athleteId: string) => string,
  found: (athleteId: string) => boolean,
): Row[] {
  const shown = shares.filter((s, i) => i < SHOWN || s.mine);
  const rest = shares.filter((s) => !shown.includes(s));
  const row = (s: PlaceShare): Row => ({
    key: s.athleteId,
    name: nameOf(s.athleteId),
    percent: s.percent,
    mine: s.mine,
    found: found(s.athleteId),
  });
  return [
    ...shown.map(row),
    ...(rest.length > 0
      ? [
          {
            key: "others",
            name: messages.consensus.others,
            percent: rest.reduce((sum, s) => sum + s.percent, 0),
            mine: false,
            found: false,
          },
        ]
      : []),
  ];
}

function Stat({ figure, text }: { figure: string; text: string }) {
  return (
    <p className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-muted p-3 dark:bg-background">
      <span className="font-mono text-xl font-bold tabular-nums">{figure}</span>
      <span className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{text}</span>
    </p>
  );
}

/**
 * What the players predicted on a locked event (#680): for each place, the athletes picked with
 * their share, my choice highlighted; the share of players with exactly my podium, my most
 * original choice and, once the result is in, the share of perfect podiums.
 */
export function ConsensusBlock({
  consensus,
  nameOf,
  official = [],
  status = "ready",
  retryHref = "",
}: {
  consensus?: Consensus;
  nameOf: (athleteId: string) => string;
  /** The official result (tied athletes share a rank): a ✓ marks who finished at each place. */
  official?: { athleteId: string; rank: number }[];
  status?: "ready" | "loading" | "error";
  retryHref?: string;
}) {
  const title = (
    <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
      {messages.consensus.title}
    </h3>
  );
  if (status === "error") {
    return (
      <div role="alert" className="mx-4 flex flex-col items-start gap-3 rounded-card bg-muted p-4">
        <p>{messages.consensus.error}</p>
        <Link href={retryHref} className={buttonVariants({ variant: "outline" })}>
          {messages.errors.retry}
        </Link>
      </div>
    );
  }
  if (status === "loading" || !consensus) {
    return (
      <div
        role="status"
        aria-label={messages.consensus.loading}
        className="mx-4 flex flex-col gap-2 rounded-card border border-border bg-card p-4"
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-xl bg-muted motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }
  if (consensus.total === 0) {
    return (
      <section className="mx-4 flex flex-col gap-2 rounded-card border border-border bg-card p-4">
        {title}
        <p className="text-muted-foreground">{messages.consensus.empty}</p>
      </section>
    );
  }

  const foundAt = (place: Place) => (athleteId: string) =>
    official.some((line) => line.athleteId === athleteId && line.rank === RANK[place]);
  const { samePodium, boldest, perfect } = consensus;

  return (
    <section className="mx-4 flex flex-col gap-4 rounded-card border border-border bg-card p-4">
      {title}
      {PLACES.map((place) => {
        const label = messages.reveal.places[place];
        return (
          <div key={place} className="flex flex-col gap-1.5">
            <h4 className="text-sm font-bold">{label}</h4>
            <ul aria-label={messages.consensus.place(label)} className="flex flex-col gap-1">
              {rowsOf(consensus.places[place], nameOf, foundAt(place)).map((row) => (
                <li
                  key={row.key}
                  aria-current={row.mine ? "true" : undefined}
                  className={`flex min-h-8 items-center gap-2 rounded-lg px-2 text-sm ${
                    row.mine
                      ? "bg-brand-soft font-bold text-brand-ink ring-1 ring-brand dark:ring-secondary"
                      : ""
                  }`}
                >
                  <span className="sr-only">
                    {messages.consensus.row(row.name, row.percent, row.mine, row.found)}
                  </span>
                  <span
                    className="flex w-28 min-w-0 shrink-0 items-center gap-1"
                    aria-hidden="true"
                  >
                    <span className="truncate">{row.name}</span>
                    {row.found && (
                      <span className="text-success-text" title={messages.consensus.found}>
                        ✓
                      </span>
                    )}
                  </span>
                  <span
                    aria-hidden="true"
                    className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted dark:bg-background"
                  >
                    <span
                      className={`block h-full rounded-full ${
                        row.mine ? "bg-brand dark:bg-secondary" : "bg-muted-foreground/50"
                      }`}
                      style={{ width: `${row.percent}%` }}
                    />
                  </span>
                  {row.mine && (
                    <span aria-hidden="true" className="text-xs font-bold">
                      {messages.consensus.mine}
                    </span>
                  )}
                  <span aria-hidden="true" className="w-11 text-right font-mono tabular-nums">
                    {messages.consensus.percent(row.percent)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {samePodium && boldest && (
        <div className="grid grid-cols-2 gap-2">
          {samePodium.count === 1 && consensus.total > 1 ? (
            <Stat
              figure={messages.consensus.alonePodium}
              text={messages.consensus.alonePodiumText}
            />
          ) : (
            <Stat
              figure={messages.consensus.percent(samePodium.percent)}
              text={messages.consensus.samePodium}
            />
          )}
          <Stat
            figure={messages.consensus.percent(boldest.percent)}
            text={messages.consensus.boldest(
              nameOf(boldest.athleteId),
              messages.reveal.places[boldest.place],
            )}
          />
        </div>
      )}
      {perfect && (
        <p className="rounded-xl bg-muted p-3 text-sm font-bold dark:bg-background">
          {perfect.count === 0
            ? messages.consensus.perfectNobody
            : messages.consensus.perfect(perfect.percent)}
        </p>
      )}
    </section>
  );
}
