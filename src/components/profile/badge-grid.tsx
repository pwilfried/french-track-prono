import { messages } from "@/app/messages.fr";
import { nextBadge, type BadgeProgress } from "@/domain/badges";

const text = messages.profile;

/** « Badges »: earned ones in colour, locked ones greyed with their rule, and the next one (#385). */
export function BadgeGrid({ progress }: { progress: BadgeProgress[] }) {
  const next = nextBadge(progress);
  return (
    <section aria-labelledby="badges" className="flex flex-col gap-2">
      <h2 id="badges" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {text.badges}
      </h2>
      <ul className="grid grid-cols-3 gap-2">
        {progress.map((p) => {
          const b = messages.badges[p.badge];
          const earned = p.current >= p.target;
          return (
            <li
              key={p.badge}
              data-earned={earned}
              className={`flex min-h-24 flex-col items-center gap-1 rounded-card px-2 py-3 text-center ${
                earned
                  ? "bg-gold-soft text-gold-ink"
                  : "border border-dashed border-border bg-muted text-muted-foreground"
              }`}
            >
              <span
                aria-hidden="true"
                className={`text-2xl ${earned ? "" : "opacity-50 grayscale"}`}
              >
                {b.emoji}
              </span>
              <span className="text-sm font-bold">{b.name}</span>
              <span className="text-[11px] leading-tight">{b.rule}</span>
              <span className="sr-only">{earned ? text.badgeEarned : text.badgeLocked}</span>
            </li>
          );
        })}
      </ul>
      <p className="rounded-card bg-muted p-3 text-sm font-semibold">
        {next ? text.nextBadge(messages.badges[next.badge].name, next.left) : text.allBadges}
      </p>
    </section>
  );
}
