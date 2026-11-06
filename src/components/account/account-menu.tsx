import Link from "next/link";

import { getProfile } from "@/application/get-profile";
import { UseCaseError } from "@/application/errors";
import { messages } from "@/app/messages.fr";
import { getCurrentUser, getSessionClient } from "@/app/session";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseProfileRepository } from "@/infra";

/** Top-right corner of the pages: sign-in link for a visitor, avatar and pseudo for a player. */
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

  const profile = await getProfile({
    profiles: createSupabaseProfileRepository(await getSessionClient()),
  })
    .execute({ userId: user.userId })
    .catch((error: unknown) => (error instanceof UseCaseError ? null : Promise.reject(error)));
  if (!profile) return null;

  return (
    <Link
      href="/profil"
      aria-label={messages.account.myProfile(profile.pseudo)}
      className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-full bg-white/15 py-1 pl-4 pr-1.5 text-sm font-bold text-white"
    >
      <span className="truncate">{profile.pseudo}</span>
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-full bg-card text-lg"
      >
        {profile.avatar}
      </span>
    </Link>
  );
}
