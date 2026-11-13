import { LeagueCardSkeleton } from "@/components/leagues/league-card";

import { messages } from "../messages.fr";

export default function Loading() {
  return (
    <main id="main" className="flex flex-1 flex-col" aria-busy="true">
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-6">
        <p className="sr-only" role="status">
          {messages.leagues.loadingLeagues}
        </p>
        {Array.from({ length: 3 }, (_, i) => (
          <LeagueCardSkeleton key={i} />
        ))}
      </div>
    </main>
  );
}
