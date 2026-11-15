import Link from "next/link";
import type { ReactNode } from "react";

import { messages } from "@/app/messages.fr";
import { LeagueHero } from "@/components/leagues/league-hero";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const text = messages.visitorTeaser;
const { pts } = messages.format;

/**
 * A tab a visitor cannot use yet (#934): what it is in one sentence, an example of it, then
 * « Se connecter », back to the tab once signed in.
 */
export function VisitorTeaser({
  title,
  intro,
  back,
  children,
}: {
  title: string;
  intro: string;
  /** The tab, where the sign-in brings the player back. */
  back: string;
  /** The example, made up and with nothing to tap: never a real player. */
  children: ReactNode;
}) {
  return (
    <main id="main" className="flex flex-1 flex-col">
      <LeagueHero title={title} subtitle={intro} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
        <figure className="flex flex-col gap-2">
          <figcaption className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {text.demo}
          </figcaption>
          {children}
        </figure>
        <Link
          href={`/connexion?next=${encodeURIComponent(back)}`}
          className={cn(buttonVariants(), "w-full")}
        >
          {messages.account.signIn}
        </Link>
        <p className="text-center text-sm text-muted-foreground">{messages.visitorHome.free}</p>
      </div>
    </main>
  );
}

/** A friends' league ranking, made up. */
export function LeaguesDemo() {
  const demo = text.leagues;
  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-card p-3.5">
      <p className="break-words font-extrabold">{demo.demoTitle}</p>
      <ol className="flex flex-col gap-1">
        {demo.demoRows.map((row, i) => (
          <li
            key={row.pseudo}
            className={cn(
              "flex min-h-10 items-center gap-3 rounded-xl px-2",
              "me" in row && row.me && "bg-brand-soft text-brand-ink",
            )}
          >
            <span className="w-8 shrink-0 text-center font-mono font-bold">
              {messages.leagues.rank(i + 1)}
            </span>
            <span className="min-w-0 flex-1 break-words font-semibold">{row.pseudo}</span>
            <span className="shrink-0 font-mono font-bold">{pts(row.points)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A Manager head-to-head, made up. */
export function ManagerDemo() {
  const { demoHome, demoAway } = text.manager;
  return (
    <div className="flex flex-col gap-3 rounded-card bg-nuit p-4 text-white ring-1 ring-white/10">
      <p className="text-xs font-bold uppercase tracking-wide text-[#d9e4f5]">
        {messages.managerHome.nextTitle(3)}
      </p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
        {[demoHome, demoAway].map((team, i) => (
          <span key={team.name} className={cn("flex flex-col gap-1", i === 1 && "order-3")}>
            <span className="break-words text-sm font-semibold">{team.name}</span>
            <span className="font-mono text-2xl font-extrabold">{pts(team.points)}</span>
          </span>
        ))}
        <span className="order-2 text-sm text-[#d9e4f5]">{messages.managerHome.vs}</span>
      </div>
    </div>
  );
}
