import { messages } from "@/app/messages.fr";
import type { TeamBuild } from "@/domain/manager-build";
import { cn } from "@/lib/utils";

const text = messages.catalogue.build;

/** The sentence under the families: what is missing and what the credits left allow (#1037). */
export function buildSentence(build: TeamBuild, left: number): string {
  const gaps = build.families
    .filter((f) => !f.done)
    .map((f) => ({
      name: messages.team.groups[f.family],
      count: f.missing,
      sexes: f.missingSexes,
    }));
  return text.missing(gaps, left, build.missing, build.perMissing);
}

/**
 * « Mon équipe en construction » (#1037): the count and its bar, each family ticked or to
 * complete with its figure, and one sentence on what is missing.
 */
export function TeamBuildCard({ build, left }: { build: TeamBuild; left: number }) {
  const share = build.target === 0 ? 100 : Math.min(100, (build.count / build.target) * 100);
  return (
    <section
      aria-labelledby="team-build"
      className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="team-build" className="text-sm font-bold">
          {text.title}
        </h2>
        <p className="font-mono text-sm font-bold tabular-nums">
          {text.count(build.count, build.target)}
        </p>
      </div>
      {build.bidding > 0 && (
        <p className="-mt-2 text-xs font-semibold text-muted-foreground">
          {text.withBids(build.bidding)}
        </p>
      )}
      <div
        role="progressbar"
        aria-label={text.progress(build.count, build.target)}
        aria-valuemin={0}
        aria-valuemax={build.target}
        aria-valuenow={Math.min(build.count, build.target)}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
      </div>
      <ul className="grid grid-cols-2 gap-2">
        {build.families.map((f) => (
          <li
            key={f.family}
            aria-label={text.family(messages.team.groups[f.family], f.have, f.need, f.done)}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-semibold",
              f.done ? "bg-success-soft text-success-ink" : "bg-muted",
            )}
          >
            <span aria-hidden="true" className="font-bold">
              {f.done ? "✓" : "○"}
            </span>
            <span className="min-w-0 flex-1 break-words">
              {messages.team.groups[f.family]}
              {f.bidding > 0 && (
                <span className="block font-normal text-muted-foreground">
                  {text.withBids(f.bidding)}
                </span>
              )}
            </span>
            <span aria-hidden="true" className="font-mono tabular-nums">
              {f.have}/{f.need}
            </span>
          </li>
        ))}
      </ul>
      {build.overBudget && (
        <p role="alert" className="break-words text-sm font-semibold text-accent-text">
          {text.overBudget}
        </p>
      )}
      <p className="break-words text-sm text-muted-foreground">{buildSentence(build, left)}</p>
    </section>
  );
}
