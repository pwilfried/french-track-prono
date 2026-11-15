import { PageSkeleton, SkeletonBlock } from "@/components/shell/page-skeleton";

import { messages } from "../messages.fr";

/** The community page while it loads: the tap on « Tout voir » shows at once. */
export default function Loading() {
  return (
    <PageSkeleton label={messages.loading.page}>
      <SkeletonBlock className="h-28" />
      <SkeletonBlock className="h-36" />
      <SkeletonBlock className="h-20" />
    </PageSkeleton>
  );
}
