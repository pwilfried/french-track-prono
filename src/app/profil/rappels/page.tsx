import Link from "next/link";
import { redirect } from "next/navigation";

import { getProfile } from "@/application/get-profile";
import { getReminderSettings } from "@/application/reminder-settings";
import { AccountHero } from "@/components/account/account-hero";
import { createSupabaseProfileRepository, createSupabaseReminderSettingsRepository } from "@/infra";

import { messages } from "../../messages.fr";
import { getCurrentUser, getSessionClient } from "../../session";
import { RemindersForm } from "./reminders-form";

/** « Mes rappels » (#681): which reminders the player gets, how early, and when not. */
export default async function RemindersPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent("/profil/rappels")}`);
  const client = await getSessionClient();
  const profile = await getProfile({ profiles: createSupabaseProfileRepository(client) }).execute({
    userId: user.userId,
  });
  if (!profile) redirect(`/bienvenue?next=${encodeURIComponent("/profil/rappels")}`);
  const settings = await getReminderSettings({
    settings: createSupabaseReminderSettingsRepository(client),
  }).execute();

  return (
    <main id="main" className="flex flex-1 flex-col">
      <AccountHero title={messages.reminders.title} subtitle={messages.reminders.subtitle} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-5">
        <RemindersForm initial={{ settings, saved: false, error: null }} />
        <Link
          href="/profil"
          className="flex min-h-11 items-center justify-center font-semibold text-primary underline underline-offset-4"
        >
          {messages.reminders.back}
        </Link>
      </div>
    </main>
  );
}
