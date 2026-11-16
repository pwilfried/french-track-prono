import { PageSkeleton, SkeletonBlock } from "@/components/shell/page-skeleton";

import { messages } from "../messages.fr";

/** The profile while it loads: the animal and pseudo, the figures, then the badges. */
export default function Loading() {
  return (
    <PageSkeleton label={messages.loading.profile}>
      <div className="flex items-center gap-3">
        <SkeletonBlock className="size-16 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <SkeletonBlock className="h-6 w-40" />
          <SkeletonBlock className="h-4 w-24" />
        </div>
      </div>
      <SkeletonBlock className="h-24" />
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <SkeletonBlock key={i} className="h-20" />
        ))}
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <SkeletonBlock key={i} className="h-14" />
      ))}
    </PageSkeleton>
  );
}
