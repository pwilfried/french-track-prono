import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { cn } from "@/lib/utils";

type Choice = { slug: string; name: string };

/**
 * The competition shown in « Épreuves » (#352): those of the player's leagues first, then the
 * others still to come. Plain links (?competition=), so the page stays a server component.
 */
export function CompetitionPicker({
  mine,
  others,
  selected,
}: {
  mine: Choice[];
  others: Choice[];
  selected: string;
}) {
  if (mine.length === 0 && others.length < 2) return null;
  const text = messages.events.picker;
  const group = (label: string, choices: Choice[]) =>
    choices.length === 0 ? null : (
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        <ul className="flex flex-wrap gap-2">
          {choices.map((choice) => {
            const active = choice.slug === selected;
            return (
              <li key={choice.slug}>
                <Link
                  href={`/epreuves?competition=${encodeURIComponent(choice.slug)}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full border-2 px-4 text-sm font-semibold",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card",
                  )}
                >
                  {choice.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  return (
    <nav aria-label={text.label} className="flex flex-col gap-3">
      {group(text.mine, mine)}
      {group(mine.length > 0 ? text.others : text.coming, others)}
    </nav>
  );
}
