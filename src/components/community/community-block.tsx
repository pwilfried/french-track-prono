import Link from "next/link";

import type { Community } from "@/application/community";
import { messages } from "@/app/messages.fr";
import { ErrorNotice } from "@/components/error-notice";
import { MomentCard } from "@/components/leagues/moment-card";
import { buttonVariants } from "@/components/ui/button";
import { pollPhase } from "@/domain/community";
import { cn } from "@/lib/utils";

import { AnnouncementCard } from "./announcement-card";
import { ChallengeMomentCard } from "./challenge-moment-card";
import { PollCard, type VoteAction } from "./poll-card";

const text = messages.community;

const heading = "text-xs font-bold uppercase tracking-wide text-muted-foreground";
const link = "inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4";

/**
 * On the home, the block keeps the latest of each: one announcement, one « Battez FrenchTrack »
 * challenge, one poll, a few moments.
 */
const HOME = { announcements: 1, challenges: 1, polls: 1 };

/**
 * « Dans ma communauté » (#673): the latest moments of all my leagues (each with its league), the
 * FrenchTrack announcements and computed challenges (#877), and the polls. On the home (`compact`), the latest of each and « Tout
 * voir »; on its page, everything. Null: it could not be read. Empty: what will come, and the
 * next thing to do.
 */
export function CommunityBlock({
  community,
  now,
  vote,
  compact = false,
}: {
  community: Community | null;
  now: Date;
  vote: VoteAction;
  compact?: boolean;
}) {
  const header = compact ? (
    <div className="flex items-baseline justify-between gap-2">
      <h2 id="community" className={heading}>
        {text.title}
      </h2>
      <Link href="/communaute" className={link}>
        {text.seeAll}
      </Link>
    </div>
  ) : null;
  const frame = (children: React.ReactNode) => (
    <section
      aria-labelledby={compact ? "community" : undefined}
      aria-label={compact ? undefined : text.pageTitle}
      className={cn(
        "flex flex-col gap-3",
        compact && "rounded-card border border-border bg-card/90 p-4 backdrop-blur-sm",
      )}
    >
      {header}
      {children}
    </section>
  );

  if (!community) {
    return frame(
      <ErrorNotice
        retryHref={compact ? "/" : "/communaute"}
        message={messages.errors.COMMUNITY_UNAVAILABLE}
      />,
    );
  }

  // An open poll first: it is the one thing the player can do here.
  const polls = [...community.polls].sort(
    (a, b) => Number(pollPhase(b, now) === "open") - Number(pollPhase(a, now) === "open"),
  );
  const announcements = compact
    ? community.announcements.slice(0, HOME.announcements)
    : community.announcements;
  const challenges = compact
    ? community.challenges.slice(0, HOME.challenges)
    : community.challenges;
  const shownPolls = compact ? polls.slice(0, HOME.polls) : polls;
  const { moments } = community;

  if (
    announcements.length === 0 &&
    challenges.length === 0 &&
    shownPolls.length === 0 &&
    moments.length === 0
  ) {
    return frame(
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{text.empty}</p>
        <Link
          href="/competitions"
          className={cn(buttonVariants({ variant: "outline" }), "self-start")}
        >
          {messages.ranking.predict}
        </Link>
      </div>,
    );
  }

  const part = (id: string, title: string, children: React.ReactNode) =>
    compact ? (
      <ul className="flex flex-col gap-2">{children}</ul>
    ) : (
      <section aria-labelledby={id} className="flex flex-col gap-2">
        <h2 id={id} className={heading}>
          {title}
        </h2>
        <ul className="flex flex-col gap-2">{children}</ul>
      </section>
    );

  return frame(
    <>
      {announcements.length + challenges.length > 0 &&
        part("community-announcements", text.announcementsTitle, [
          ...announcements.map((a) => (
            <li key={a.id}>
              <AnnouncementCard announcement={a} />
            </li>
          )),
          ...challenges.map((c) => (
            <li key={c.key}>
              <ChallengeMomentCard moment={c} />
            </li>
          )),
        ])}
      {shownPolls.length > 0 &&
        part(
          "community-polls",
          text.pollsTitle,
          shownPolls.map((p) => (
            <li key={p.id}>
              <PollCard poll={p} now={now} vote={vote} />
            </li>
          )),
        )}
      {moments.length > 0 &&
        part(
          "community-moments",
          text.momentsTitle,
          moments.map((m) => (
            <li key={`${m.leagueId}:${m.key}`}>
              <MomentCard moment={m} leagueName={m.leagueName} />
            </li>
          )),
        )}
    </>,
  );
}
