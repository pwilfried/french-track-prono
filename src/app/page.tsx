import Link from "next/link";

import { PlayerHome } from "@/components/home/player-home";
import { buttonVariants } from "@/components/ui/button";
import { daysUntil, type CompetitionScope } from "@/domain/competition";

import { currentDay, loadCompetitions, SCOPE_CHIP, type ShownCompetition } from "./competition";
import { loadPlayerHome } from "./home-data";
import { messages } from "./messages.fr";
import { getCurrentUser } from "./session";

const SCOPES: CompetitionScope[] = ["international", "france"];

function ScopeIcon({ scope }: { scope: CompetitionScope }) {
  if (scope === "france") {
    return (
      <span aria-hidden="true" className="flex gap-0.5">
        <span className="h-6 w-2 rounded-sm bg-brand" />
        <span className="h-6 w-2 rounded-sm border border-border bg-white" />
        <span className="h-6 w-2 rounded-sm bg-primary" />
      </span>
    );
  }
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </svg>
  );
}

function NextCompetition({ c, today }: { c: ShownCompetition; today: string }) {
  return (
    <article className="flex flex-col gap-3.5 rounded-card border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${SCOPE_CHIP[c.scope]}`}>
          {messages.adminCompetitions.scope[c.scope]}
        </span>
        <span className="rounded-full bg-gold-soft px-2.5 py-1 font-mono text-xs font-bold text-gold-ink">
          {messages.start.inDays(daysUntil(c.startsOn, today))}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-[22px] font-extrabold leading-tight">{c.name}</h3>
        <p className="text-sm text-muted-foreground">
          {[c.place, messages.start.events(c.finals)].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="flex gap-2">
        <Link href={`/ligues/creer?competition=${c.slug}`} className={`${buttonVariants()} flex-1`}>
          {messages.start.createLeague}
        </Link>
        <Link href={`/competitions/${c.slug}`} className={buttonVariants({ variant: "outline" })}>
          {messages.start.open}
        </Link>
      </div>
    </article>
  );
}

/**
 * Home: a running track behind (#346). A signed-in player first sees what to do next and where they
 * stand (board A+); everyone sees the two kinds of competitions, then the next two to come.
 */
export default async function Home() {
  const today = currentDay();
  const user = await getCurrentUser();
  const [{ coming }, player] = await Promise.all([
    loadCompetitions(),
    user ? loadPlayerHome(user.userId) : Promise.resolve(null),
  ]);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6 md:max-w-3xl">
        {player ? (
          <PlayerHome
            pseudo={player.pseudo}
            competitionName={player.competition.name}
            competitionSlug={player.competition.slug}
            hasLeagueForCompetition={player.hasLeagueForCompetition}
            timeZone={player.competition.timeZone}
            now={new Date()}
            finals={player.finals}
            general={player.general}
            league={player.league}
            lastResult={player.lastResult}
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {messages.start.eyebrow}
            </p>
            <h1 className="font-display text-[34px] font-extrabold leading-none">
              {messages.start.title}
            </h1>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              {messages.start.intro}
            </p>
            <Link href="/regles" className="inline-flex min-h-11 items-center self-start font-bold">
              {messages.rules.link}
            </Link>
          </div>
        )}

        <nav aria-label={messages.start.blocksLabel} className="grid grid-cols-2 gap-3">
          {SCOPES.map((scope) => (
            <Link
              key={scope}
              href={`/competitions?type=${scope}`}
              className={`flex min-h-[150px] flex-col justify-between gap-4 rounded-card p-4 ${
                scope === "international"
                  ? "bg-brand text-white"
                  : "border border-border bg-card text-foreground"
              }`}
            >
              <ScopeIcon scope={scope} />
              <span className="flex flex-col gap-1">
                <span className="font-display text-[19px] font-extrabold leading-tight">
                  {messages.start.block[scope]}
                </span>
                <span
                  className={`text-sm ${scope === "international" ? "text-[#d9e4f5]" : "text-muted-foreground"}`}
                >
                  {messages.start.coming(coming.filter((c) => c.scope === scope).length)}
                </span>
              </span>
            </Link>
          ))}
        </nav>

        <section aria-labelledby="next-competitions" className="flex flex-col gap-3">
          <h2
            id="next-competitions"
            className="border-b border-border pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground"
          >
            {messages.start.next}
          </h2>
          {coming.length === 0 ? (
            <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
              {messages.start.none}
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {coming.slice(0, 2).map((c) => (
                <NextCompetition key={c.slug} c={c} today={today} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
