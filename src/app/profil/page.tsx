import Link from "next/link";
import { redirect } from "next/navigation";

import { getProfile } from "@/application/get-profile";
import { AccountHero } from "@/components/account/account-hero";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseProfileRepository } from "@/infra";

import { messages } from "../messages.fr";
import { getCurrentUser, getSessionClient } from "../session";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent("/profil")}`);

  const profile = await getProfile({
    profiles: createSupabaseProfileRepository(await getSessionClient()),
  }).execute({ userId: user.userId });
  if (!profile) redirect(`/bienvenue?next=${encodeURIComponent("/profil")}`);

  const since = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(profile.ageConfirmedAt);

  return (
    <main className="flex flex-1 flex-col">
      <AccountHero title={messages.profile.title} subtitle={messages.profile.since(since)} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span
            aria-hidden="true"
            className="grid size-24 place-items-center rounded-full bg-muted text-5xl"
          >
            {profile.avatar}
          </span>
          <p className="break-words text-2xl font-extrabold">{profile.pseudo}</p>
        </div>

        <Link href="/mes-points" className={`${buttonVariants({ variant: "muted" })} w-full`}>
          {messages.points.profileLink} ›
        </Link>
        <Link href="/epreuves" className={`${buttonVariants()} w-full`}>
          {messages.profile.back}
        </Link>
        <form action="/auth/sign-out" method="post">
          <button type="submit" className={`${buttonVariants({ variant: "muted" })} w-full`}>
            {messages.profile.signOut}
          </button>
        </form>
        <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">
          {messages.profile.emailPrivate}
        </p>
      </div>
    </main>
  );
}
