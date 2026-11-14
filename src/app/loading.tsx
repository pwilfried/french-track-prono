import { PageSkeleton, SkeletonBlock } from "@/components/shell/page-skeleton";

import { messages } from "./messages.fr";

/**
 * The home while it loads (#824), and every page without a skeleton of its own: the tap shows at
 * once (« Penser joueur », rule 1).
 */
export default function Loading() {
  return (
    <PageSkeleton label={messages.loading.page}>
      <SkeletonBlock className="h-32" />
      <SkeletonBlock className="h-20" />
      <SkeletonBlock className="h-20" />
      <SkeletonBlock className="h-24" />
    </PageSkeleton>
  );
}
