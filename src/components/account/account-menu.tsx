import Link from "next/link";

import { messages } from "@/app/messages.fr";
import { isAdmin } from "@/app/landing";
import { getCurrentUser, getSessionClient } from "@/app/session";
import { lookUpProfile } from "@/application/get-profile";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseProfileRepository } from "@/infra";

/** Right side of the top bar: sign-in link for a visitor, pseudo and avatar for a player, plus a way
 * back to the back-office for an admin. */
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

  const client = await getSessionClient();
  const [profile, admin] = await Promise.all([
    lookUpProfile({ profiles: createSupabaseProfileRepository(client) }).execute({
      userId: user.userId,
    }),
    isAdmin(client, user.userId),
  ]);
  if (profile === null || profile === "unavailable") return null;

  return (
    <div className="flex min-w-0 items-center gap-2">
      {admin && (
        <Link
          href="/admin/tableau-de-bord"
          className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-3.5 text-sm font-bold text-primary-foreground"
        >
          {messages.account.backOffice}
        </Link>
      )}
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
    </div>
  );
}
