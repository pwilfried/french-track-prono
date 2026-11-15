import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountHero } from "@/components/account/account-hero";
import { CommunityBlock } from "@/components/community/community-block";

import { votePollAction } from "../community-actions";
import { loadCommunity } from "../community-data";
import { messages } from "../messages.fr";
import { getCurrentUser } from "../session";

/** « Tout voir » of the community block (#673): every announcement, poll and recent moment. */
const PAGE_MOMENTS = 30;

export default async function CommunityPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent("/communaute")}`);
  const community = await loadCommunity(PAGE_MOMENTS);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <AccountHero
        title={messages.community.pageTitle}
        subtitle={messages.community.pageSubtitle}
      />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
        <CommunityBlock community={community} now={new Date()} vote={votePollAction} />
        <Link
          href="/"
          className="inline-flex min-h-11 items-center self-center text-sm font-bold underline underline-offset-4"
        >
          {messages.community.back}
        </Link>
      </div>
    </main>
  );
}
