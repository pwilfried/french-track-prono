import { CompetitionButtonSkeleton } from "@/components/events/competition-button";
import { DayBarSkeleton } from "@/components/events/day-bar";

import { messages } from "../messages.fr";

export default function Loading() {
  return (
    <main id="main" className="flex flex-1 flex-col" aria-busy="true">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-5">
        <p className="sr-only" role="status">
          {messages.events.loading}
        </p>
        <CompetitionButtonSkeleton />
        <DayBarSkeleton />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-card bg-muted" />
        ))}
      </div>
    </main>
  );
}
