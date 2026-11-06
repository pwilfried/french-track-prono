import { messages } from "@/app/messages.fr";
import type { ResultLine } from "@/domain/event";
import { podiumSteps } from "@/domain/podium";
import { cn } from "@/lib/utils";

const stepStyle = {
  1: { height: "h-24", color: "bg-secondary text-secondary-foreground" },
  2: { height: "h-16", color: "bg-[#c9ced8] text-nuit" },
  3: { height: "h-12", color: "bg-primary text-primary-foreground" },
} as const;

// Display order: second on the left, winner in the middle, third on the right.
const displayOrder = [2, 1, 3] as const;

/** Official podium. Tied athletes share a step; with no result the three steps stay empty. */
export function PodiumDisplay({ results }: { results: ResultLine[] }) {
  const steps = podiumSteps(results);
  const hasResult = steps.some((step) => step.athletes.length > 0);

  return (
    <section aria-label={messages.event.podium} className="text-[#f8f8f8]">
      <ol className="flex items-end justify-center gap-2">
        {displayOrder.map((rank) => {
          const step = steps.find((s) => s.rank === rank)!;
          const style = stepStyle[rank];
          return (
            <li key={rank} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <ul className="flex flex-col items-center gap-2 text-center">
                {step.athletes.map((athlete) => (
                  <li key={athlete.athleteId} className="flex min-w-0 flex-col items-center">
                    <span className="max-w-full break-words font-display text-base font-bold leading-tight">
                      {athlete.name}
                    </span>
                    <span className="text-sm text-[#dce6f5]">{athlete.countryCode}</span>
                    {athlete.mark && <span className="text-lg font-bold">{athlete.mark}</span>}
                  </li>
                ))}
              </ul>
              <div
                className={cn(
                  "flex w-full items-start justify-center rounded-t-2xl pt-2 text-2xl font-extrabold",
                  style.height,
                  style.color,
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
        <p className="mt-3 text-center text-[#dce6f5]">{messages.event.podiumEmpty}</p>
      )}
    </section>
  );
}
