import { Leaderboard } from "@/components/leaderboard/leaderboard";
import { Podium } from "@/components/leaderboard/podium";
import { PageSkeleton, SkeletonBlock } from "@/components/shell/page-skeleton";

import { messages } from "../messages.fr";

/** The rankings while they load (#824): the view tabs, the podium and the first rows. */
export default function Loading() {
  return (
    <PageSkeleton label={messages.leaderboard.loading}>
      <SkeletonBlock className="h-11" />
      <SkeletonBlock className="h-14" />
      <Podium rows={[]} status="loading" />
      <Leaderboard rows={[]} status="loading" />
    </PageSkeleton>
  );
}
