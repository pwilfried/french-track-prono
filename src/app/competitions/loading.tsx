import { CompetitionButtonSkeleton } from "@/components/events/competition-button";
import { DayBarSkeleton } from "@/components/events/day-bar";
import { PageSkeleton, SkeletonBlock } from "@/components/shell/page-skeleton";

import { messages } from "../messages.fr";

export default function Loading() {
  return (
    <PageSkeleton label={messages.events.loading}>
      <CompetitionButtonSkeleton />
      <DayBarSkeleton />
      {Array.from({ length: 4 }, (_, i) => (
        <SkeletonBlock key={i} className="h-16" />
      ))}
    </PageSkeleton>
  );
}
