import { PageSkeleton, SkeletonBlock } from "@/components/shell/page-skeleton";

import { messages } from "../messages.fr";

/**
 * The home while it loads (#824): the tap shows at once (« Penser joueur », rule 1). It lives in
 * the `(accueil)` group, not at the root: a root skeleton would wrap every page, so a page that
 * answers « not found » would stream with a 200, and the back-office would render after its menu.
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
