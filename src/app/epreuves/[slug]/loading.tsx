import { PageSkeleton, SkeletonBlock } from "@/components/shell/page-skeleton";

import { messages } from "../../messages.fr";

/** An event while it loads (#824): its title and lock, the podium, then the start list. */
export default function Loading() {
  return (
    <PageSkeleton label={messages.loading.event}>
      <SkeletonBlock className="h-4 w-28" />
      <SkeletonBlock className="h-16" />
      <SkeletonBlock className="h-12" />
      <div className="grid grid-cols-3 items-end gap-2">
        <SkeletonBlock className="h-28" />
        <SkeletonBlock className="h-36" />
        <SkeletonBlock className="h-24" />
      </div>
      {Array.from({ length: 4 }, (_, i) => (
        <SkeletonBlock key={i} className="h-14" />
      ))}
    </PageSkeleton>
  );
}
