import { redirect } from "next/navigation";

import { getProfile } from "@/application/get-profile";
import { AccountHero } from "@/components/account/account-hero";
import { safeRedirectPath } from "@/domain/redirect";
import { createSupabaseProfileRepository } from "@/infra";

import { messages } from "../messages.fr";
import { getCurrentUser, getSessionClient } from "../session";
import { WelcomeForm } from "./welcome-form";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeRedirectPath((await searchParams).next);
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent("/bienvenue")}`);

  const profile = await getProfile({
    profiles: createSupabaseProfileRepository(await getSessionClient()),
  }).execute({ userId: user.userId });
  if (profile) redirect(next);

  return (
    <main id="main" className="flex flex-1 flex-col">
      <AccountHero title={messages.welcome.title} subtitle={messages.welcome.subtitle} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-5">
        <WelcomeForm next={next} />
      </div>
    </main>
  );
}
