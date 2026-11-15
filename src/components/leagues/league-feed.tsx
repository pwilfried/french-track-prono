import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { buttonVariants } from "@/components/ui/button";
import type { FeedGroup, FeedGroupTitle } from "@/domain/league-moments";
import { NO_REACTIONS, type MomentReactions as Reactions } from "@/domain/moment-reactions";

import { MomentCard } from "./moment-card";
import { MomentReactions, type MomentReactionActions } from "./moment-reactions";

const text = messages.leagues.feed;

const titleOf = (title: FeedGroupTitle) =>
  title.kind === "tonight"
    ? text.tonight(title.competitionName)
    : title.kind === "yesterday"
      ? text.yesterday
      : text.day(title.day);

/**
 * The « Fil » tab of a league (#671), prediction or Manager (#875): the moments the app tells,
 * latest first, grouped « Ce soir · <compétition> », « Hier », then by day. Nobody writes in it:
 * the members react with emojis and preset messages (#672), when `reactions` are given. Empty:
 * what it will tell, and the next thing to do.
 */
export function LeagueFeed({
  groups,
  reactions,
  empty = { text: text.empty, href: "/competitions", action: messages.ranking.predict },
}: {
  groups: FeedGroup[];
  reactions?: {
    leagueId: string;
    byMoment: Record<string, Reactions>;
    actions: MomentReactionActions;
  };
  /** What an empty feed says, and its next action: a Manager league points to its mercato. */
  empty?: { text: string; href: string; action: string };
}) {
  if (groups.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-card bg-muted p-4">
        <p className="text-sm text-muted-foreground">{empty.text}</p>
        <Link href={empty.href} className={`${buttonVariants({ variant: "outline" })} self-start`}>
          {empty.action}
        </Link>
      </div>
    );
  }
  return (
    <section aria-label={text.title} className="flex flex-col gap-4">
      {groups.map((group) => (
        <section
          key={group.id}
          aria-labelledby={`feed-${group.id}`}
          className="flex flex-col gap-2"
        >
          <h2
            id={`feed-${group.id}`}
            className="break-words text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            {titleOf(group.title)}
          </h2>
          <ul className="flex flex-col gap-2">
            {group.moments.map((moment) => (
              <li key={moment.key}>
                <MomentCard moment={moment}>
                  {reactions && (
                    <MomentReactions
                      leagueId={reactions.leagueId}
                      momentKey={moment.key}
                      reactions={reactions.byMoment[moment.key] ?? NO_REACTIONS}
                      actions={reactions.actions}
                    />
                  )}
                </MomentCard>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
