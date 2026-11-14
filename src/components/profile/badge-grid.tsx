import { messages } from "@/app/messages.fr";
import { Dossard } from "@/components/band/dossard";
import { isEarned, nextBadge, type BadgeProgress } from "@/domain/badges";

const text = messages.profile;

/**
 * « Badges » as bibs (#768): the game badges carry the hare, the mascot; earned ones show their
 * level band (bronze until the levels of #821), locked ones are grey with their rule. Then the
 * badge closest to being earned (#385).
 */
export function BadgeGrid({ progress }: { progress: BadgeProgress[] }) {
  const next = nextBadge(progress);
  return (
    <section aria-labelledby="badges" className="flex flex-col gap-2">
      <h2 id="badges" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {text.badges}
      </h2>
      <ul className="grid grid-cols-3 gap-2">
        {progress.map((p, i) => {
          const b = messages.badges[p.badge];
          const earned = isEarned(p);
          return (
            <li key={p.badge} data-earned={earned} className="flex flex-col items-center gap-1">
              <Dossard
                animal="lievre"
                number={String(i + 1).padStart(2, "0")}
                name={b.name}
                level={earned ? "bronze" : null}
              />
              <span className="text-center text-[11px] leading-tight text-muted-foreground">
                {b.rule}
              </span>
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
