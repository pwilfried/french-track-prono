import { PageSkeleton, SkeletonBlock } from "@/components/shell/page-skeleton";

import { messages } from "../messages.fr";

/** The Manager while it loads (#824): its head, then its league cards. */
export default function Loading() {
  return (
    <PageSkeleton label={messages.loading.manager}>
      <SkeletonBlock className="h-28" />
      {Array.from({ length: 3 }, (_, i) => (
        <SkeletonBlock key={i} className="h-24" />
      ))}
    </PageSkeleton>
  );
}
