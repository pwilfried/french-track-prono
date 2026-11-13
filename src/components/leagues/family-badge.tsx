import { messages } from "@/app/messages.fr";
import { LEAGUE_FAMILIES, type LeagueFamily } from "@/domain/league-families";
import { cn } from "@/lib/utils";

const text = messages.leagues;

/**
 * « Sprint · Haies » (#613): the families a league is limited to, on its card and its page.
 * Nothing for a league on all events.
 */
export function FamilyBadge({
  families,
  className,
}: {
  families: LeagueFamily[];
  className?: string;
}) {
  const names = LEAGUE_FAMILIES.filter((f) => families.includes(f)).map((f) => text.family[f]);
  if (names.length === 0) return null;
  return (
    <span
      aria-label={text.familiesBadgeLabel(names)}
      className={cn(
        "inline-flex max-w-full items-center rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold break-words text-brand-ink",
        className,
      )}
    >
      {text.familiesBadge(names)}
    </span>
  );
}
