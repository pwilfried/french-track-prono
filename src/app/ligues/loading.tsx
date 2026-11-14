import { LeagueCardSkeleton } from "@/components/leagues/league-card";
import { PageSkeleton } from "@/components/shell/page-skeleton";

import { messages } from "../messages.fr";

export default function Loading() {
  return (
    <PageSkeleton label={messages.leagues.loadingLeagues}>
      {Array.from({ length: 3 }, (_, i) => (
        <LeagueCardSkeleton key={i} />
      ))}
    </PageSkeleton>
  );
}
