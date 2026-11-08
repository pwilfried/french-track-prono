import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { lookUpProfile } from "@/app/profile-lookup";
import { getCurrentUser, getSessionClient } from "@/app/session";
import { buttonVariants } from "@/components/ui/button";

/** Right side of the top bar: sign-in link for a visitor, pseudo and avatar for a player. */
export async function AccountMenu({ returnTo }: { returnTo: string }) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Link
        href={`/connexion?next=${encodeURIComponent(returnTo)}`}
        className={buttonVariants({ size: "default" }) + " min-h-11 px-4 py-2 text-sm"}
      >
        {messages.account.signIn}
      </Link>
    );
  }

  const profile = await lookUpProfile(await getSessionClient(), user.userId);
  if (profile === null || profile === "unavailable") return null;

  return (
    <Link
      href="/profil"
      aria-label={messages.account.myProfile(profile.pseudo)}
      className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-full border border-border bg-card py-1 pl-4 pr-1.5 text-sm font-bold text-card-foreground"
    >
      <span className="truncate">{profile.pseudo}</span>
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-full bg-background text-lg"
      >
        {profile.avatar}
      </span>
    </Link>
  );
}
