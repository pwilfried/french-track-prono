import { messages } from "@/app/messages.fr";
import type { ResultLine } from "@/domain/event";
import { podiumSteps } from "@/domain/podium";
import { cn } from "@/lib/utils";

/**
 * Official podium with medal gradients (gold / silver / bronze).
 * - Same `podiumSteps` domain helper as PodiumDisplay (ties share a step).
 * - Each step's text uses its medal's ink color, audited ≥ WCAG AA.
 * Prefer this variant for a result screen; use PodiumDisplay on dark surfaces where a
 * uniform gold reads better.
 */

type StepStyle = {
  height: string;
  gradientFrom: string;
  gradientTo: string;
  text: string;
};

const stepStyle: Record<1 | 2 | 3, StepStyle> = {
  1: {
    height: "h-28 sm:h-32",
    gradientFrom: "from-(--medal-gold-from)",
    gradientTo: "to-(--medal-gold-to)",
    text: "text-(--medal-gold-ink)",
  },
  2: {
    height: "h-20 sm:h-24",
    gradientFrom: "from-(--medal-silver-from)",
    gradientTo: "to-(--medal-silver-to)",
    text: "text-(--medal-silver-ink)",
  },
  3: {
    height: "h-16 sm:h-20",
    gradientFrom: "from-(--medal-bronze-from)",
    gradientTo: "to-(--medal-bronze-to)",
    text: "text-(--medal-bronze-ink)",
  },
};

const displayOrder = [2, 1, 3] as const;

export function PodiumMedals({ results }: { results: ResultLine[] }) {
  const steps = podiumSteps(results);
  const hasResult = steps.some((step) => step.athletes.length > 0);

  return (
    <section aria-label={messages.event.podium}>
      <ol className="flex items-end justify-center gap-2">
        {displayOrder.map((rank) => {
          const step = steps.find((s) => s.rank === rank)!;
          const style = stepStyle[rank];
          return (
            <li key={rank} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <ul className="flex flex-col items-center gap-1 text-center">
                {step.athletes.map((athlete) => (
                  <li key={athlete.athleteId} className="flex min-w-0 flex-col items-center">
                    <span className="max-w-full break-words font-display text-sm font-bold leading-tight text-card-foreground">
                      {athlete.name}
                    </span>
                    <span className="text-xs text-muted-foreground">{athlete.countryCode}</span>
                    {athlete.mark && (
                      <span className="text-sm font-bold tabular-nums text-card-foreground">
                        {athlete.mark}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <div
                className={cn(
                  "flex w-full items-start justify-center rounded-t-2xl bg-gradient-to-b pt-2 font-display text-2xl font-extrabold",
                  style.height,
                  style.gradientFrom,
                  style.gradientTo,
                  style.text,
                )}
              >
                <span aria-hidden="true">{rank}</span>
                <span className="sr-only">{messages.event.podiumStep(rank)}</span>
              </div>
            </li>
          );
        })}
      </ol>
      {!hasResult && (
        <p className="mt-3 text-center text-muted-foreground">{messages.event.podiumEmpty}</p>
      )}
    </section>
  );
}
