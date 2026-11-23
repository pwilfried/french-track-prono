import Link from "next/link";
import { redirect } from "next/navigation";

import { getProfile } from "@/application/get-profile";
import { getReminderSettings } from "@/application/reminder-settings";
import { getPlayerDetails } from "@/application/player-details";
import { NotificationOptIn } from "@/components/account/notification-opt-in";
import { SubmitButton } from "@/components/account/submit-button";
import { InstallEntry } from "@/components/shell/install-prompt";
import { SHOWN_REMINDER_FAMILIES } from "@/domain/reminders";
import {
  createSupabasePlayerDetailsRepository,
  createSupabaseReminderSettingsRepository,
} from "@/infra";

import { messages } from "../../messages.fr";
import { turnOffNotificationsAction, turnOnNotificationsAction } from "../../push-actions";
import { readOr } from "../../read-or";
import { getCurrentUser, getSessionClient, getSessionProfiles } from "../../session";

const text = messages.settings;
const CARD = "flex flex-col divide-y divide-border rounded-card border border-border bg-card";
const ROW = "flex min-h-[60px] items-center justify-between gap-3 px-4 py-2";
const ACTION =
  "inline-flex min-h-11 shrink-0 items-center font-semibold text-primary underline underline-offset-4";

function Group({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className={CARD}>{children}</div>
    </section>
  );
}

/** A row with a label, a small grey value and an action link on the right. */
function ValueRow({
  label,
  value,
  href,
  action,
  tag,
}: {
  label: string;
  value: string;
  href: string;
  action: string;
  tag?: string;
}) {
  return (
    <div className={ROW}>
      <div className="min-w-0">
        <p className="font-bold">
          {label}
          {tag && (
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-bold">{tag}</span>
          )}
        </p>
        <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{value}</p>
      </div>
      <Link href={href} aria-label={`${action} : ${label}`} className={ACTION}>
        {action}
      </Link>
    </div>
  );
}

/** « Réglages » (#1137): the account, the notifications and the app, out of the profile. */
export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent("/profil/reglages")}`);
  const client = await getSessionClient();
  const profile = await getProfile({ profiles: await getSessionProfiles() }).execute({
    userId: user.userId,
  });
  if (!profile) redirect(`/bienvenue?next=${encodeURIComponent("/profil/reglages")}`);
  const [details, reminders] = await Promise.all([
    readOr(
      "settings details",
      getPlayerDetails({ details: createSupabasePlayerDetailsRepository(client) }).execute({
        userId: user.userId,
      }),
      null,
    ),
    readOr(
      "settings reminders",
      getReminderSettings({
        settings: createSupabaseReminderSettingsRepository(client),
      }).execute(),
      null,
    ),
  ]);
  const on = reminders
    ? SHOWN_REMINDER_FAMILIES.filter((family) => reminders.families[family]).length
    : null;

  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <Link
        href="/profil"
        className="inline-flex min-h-11 items-center self-start font-semibold text-primary"
      >
        {text.back}
      </Link>
      <h1 className="font-display text-2xl font-extrabold">{text.title}</h1>

      <Group id="settings-account" title={text.account}>
        <ValueRow
          label={text.pseudo}
          value={text.pseudoValue(profile.pseudo, profile.bib.number)}
          href="/profil/modifier"
          action={text.edit}
        />
        <ValueRow
          label={text.club}
          value={
            details?.club ? text.clubValue(details.club.name, details.club.validated) : text.noClub
          }
          href="/profil/modifier"
          action={text.change}
        />
        <ValueRow
          label={text.email}
          tag={text.private}
          value={user.email}
          href="/profil/email"
          action={text.change}
        />
      </Group>

      <Group id="settings-notifications" title={text.notifications}>
        <NotificationOptIn
          layout="row"
          turnOn={turnOnNotificationsAction}
          turnOff={turnOffNotificationsAction}
        />
        <Link href="/profil/rappels" className={ROW}>
          <span className="min-w-0">
            <span className="block font-bold">{text.reminders}</span>
            {on !== null && (
              <span className="block text-sm text-muted-foreground">
                {text.remindersSummary(on, SHOWN_REMINDER_FAMILIES.length)}
              </span>
            )}
          </span>
          <span aria-hidden="true">›</span>
        </Link>
      </Group>

      <Group id="settings-app" title={text.app}>
        <InstallEntry grouped />
        <Link href="/regles" className={ROW}>
          <span className="font-bold">{text.rules}</span>
          <span aria-hidden="true">›</span>
        </Link>
      </Group>

      <p className="text-sm text-muted-foreground">{text.privacy}</p>
      <form action="/auth/sign-out" method="post">
        <SubmitButton variant="outline" pendingLabel={text.signingOut} navigates>
          {text.signOut}
        </SubmitButton>
      </form>
      <Link
        href="/profil/supprimer"
        className="flex min-h-11 items-center justify-center text-sm font-semibold text-accent-text underline underline-offset-4"
      >
        {text.deleteLink}
      </Link>
    </main>
  );
}
