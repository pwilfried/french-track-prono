import { messages } from "@/app/messages.fr";
import {
  FAMILY_BADGES,
  nextBadge,
  nextLevel,
  type Badge,
  type BadgeLevel,
  type BadgeProgress,
} from "@/domain/badges";
import { cn } from "@/lib/utils";

const text = messages.profile;
const levels = messages.badgeLevels;

/**
 * The colours of each level, as the medals of the podium, until the bib visuals of #768: a medal
 * behind the emoji, and a label in a solid tone that keeps its text readable (AA).
 */
const MEDAL: Record<BadgeLevel, string> = {
  bronze: "bg-gradient-to-b from-(--medal-bronze-from) to-(--medal-bronze-to)",
  silver: "bg-gradient-to-b from-(--medal-silver-from) to-(--medal-silver-to)",
  gold: "bg-gradient-to-b from-(--medal-gold-from) to-(--medal-gold-to)",
};
const LABEL: Record<BadgeLevel, string> = {
  bronze: "bg-(--medal-bronze-to) text-white",
  silver: "bg-(--medal-silver-from) text-(--medal-silver-ink)",
  gold: "bg-(--medal-gold-from) text-(--medal-gold-ink)",
};

const isFamily = (badge: Badge) => (FAMILY_BADGES as readonly Badge[]).includes(badge);

/** What is left to the next level: a count, or points for a family badge. */
export function badgeLeft(badge: Badge, left: number): string {
  return isFamily(badge) ? messages.format.pts(left) : String(left);
}

function BadgeTile({ p }: { p: BadgeProgress }) {
  const b = messages.badges[p.badge];
  const next = nextLevel(p.level);
  return (
    <li
      data-earned={p.level !== null}
      data-level={p.level ?? "none"}
      className={cn(
        "flex min-h-28 min-w-0 flex-col items-center gap-1 rounded-card px-2 py-3 text-center",
        p.level
          ? "border border-border bg-card"
          : "border border-dashed border-border bg-muted text-muted-foreground",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-11 place-items-center rounded-full text-2xl",
          p.level ? MEDAL[p.level] : "opacity-50 grayscale",
        )}
      >
        {b.emoji}
      </span>
      <span className="text-sm font-bold break-words">{b.name}</span>
      {p.level ? (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-extrabold tracking-wider uppercase",
            LABEL[p.level],
          )}
        >
          <span className="sr-only">{text.badgeLevel(levels.name[p.level])}</span>
          <span aria-hidden="true">{levels.name[p.level]}</span>
        </span>
      ) : (
        <span className="text-[11px] font-extrabold tracking-wider uppercase">
          {text.badgeLocked}
        </span>
      )}
      <span className="text-[11px] leading-tight break-words">{b.counts}</span>
      <span className="text-[11px] leading-tight font-semibold break-words">
        {next ? text.badgeToNext(p.current, p.target, levels.the[next]) : text.badgeMax}
      </span>
    </li>
  );
}

/**
 * « Badges » (#385, #821): each badge with its level (bronze, silver, gold) or greyed until won,
 * what it counts this season, the next threshold, and the badge nearest to its next level.
 */
export function BadgeGrid({ progress }: { progress: BadgeProgress[] }) {
  const next = nextBadge(progress);
  const game = progress.filter((p) => !isFamily(p.badge));
  const family = progress.filter((p) => isFamily(p.badge));
  return (
    <section aria-labelledby="badges" className="flex flex-col gap-2">
      <h2 id="badges" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {text.badges}
      </h2>
      <ul aria-labelledby="badges" className="grid grid-cols-3 gap-2">
        {game.map((p) => (
          <BadgeTile key={p.badge} p={p} />
        ))}
      </ul>
      {family.length > 0 && (
        <>
          <h3
            id="family-badges"
            className="mt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            {text.familyBadges}
          </h3>
          <p className="text-xs text-muted-foreground">{text.familyBadgesHint}</p>
          <ul aria-labelledby="family-badges" className="grid grid-cols-3 gap-2">
            {family.map((p) => (
              <BadgeTile key={p.badge} p={p} />
            ))}
          </ul>
        </>
      )}
      <p className="rounded-card bg-muted p-3 text-sm font-semibold">
        {next
          ? text.nextBadge(
              messages.badges[next.badge].name,
              levels.the[next.next],
              badgeLeft(next.badge, next.left),
            )
          : text.allBadges}
      </p>
    </section>
  );
}
