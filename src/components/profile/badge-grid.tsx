import { messages } from "@/app/messages.fr";
import { Dossard } from "@/components/band/dossard";
import {
  BADGE_FAMILIES,
  FAMILY_BADGES,
  nextBadge,
  nextLevel,
  type Badge,
  type BadgeProgress,
  type FamilyBadge,
} from "@/domain/badges";
import { animalOf, type Animal } from "@/domain/band";

const text = messages.profile;
const levels = messages.badgeLevels;

const isFamily = (badge: Badge): badge is FamilyBadge =>
  (FAMILY_BADGES as readonly Badge[]).includes(badge);

/** The animal on the bib: the one of the family for a family badge, the hare (the mascot) else. */
function animalFor(badge: Badge): Animal {
  return (isFamily(badge) && animalOf(BADGE_FAMILIES[badge][0])) || "lievre";
}

/** What is left to the next level: a count, or points for a family badge. */
export function badgeLeft(badge: Badge, left: number): string {
  return isFamily(badge) ? messages.format.pts(left) : String(left);
}

function BadgeTile({ p, number }: { p: BadgeProgress; number: number }) {
  const b = messages.badges[p.badge];
  const next = nextLevel(p.level);
  return (
    <li
      data-earned={p.level !== null}
      data-level={p.level ?? "none"}
      className="flex min-w-0 flex-col items-center gap-1 text-center"
    >
      <Dossard
        animal={animalFor(p.badge)}
        number={String(number).padStart(2, "0")}
        name={b.name}
        level={p.level}
      />
      {p.level && <span className="sr-only">{text.badgeLevel(levels.name[p.level])}</span>}
      <span className="text-[11px] leading-tight break-words text-muted-foreground">
        {b.counts}
      </span>
      <span className="text-[11px] leading-tight font-semibold break-words">
        {next ? text.badgeToNext(p.current, p.target, levels.the[next]) : text.badgeMax}
      </span>
    </li>
  );
}

/**
 * « Badges » as bibs (#385, #768, #821): each badge with the band of its level (bronze, silver,
 * gold) or grey until won, the hare for the game badges and the animal of the family for the
 * others, what it counts this season, the next threshold, and the badge nearest to its next level.
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
        {game.map((p, i) => (
          <BadgeTile key={p.badge} p={p} number={i + 1} />
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
            {family.map((p, i) => (
              <BadgeTile key={p.badge} p={p} number={game.length + i + 1} />
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
