import { notFound } from "next/navigation";

import { listDemoPlayers } from "@/application/demo-login";
import { UseCaseError, type ErrorCode } from "@/application/errors";
import { SubmitButton } from "@/components/account/submit-button";
import { ErrorNotice } from "@/components/error-notice";
import {
  createServiceRoleClient,
  createSupabaseDemoAccounts,
  createSupabaseProfileRepository,
} from "@/infra";

import { demoLoginEnabled } from "../../demo-login";
import { signInAsDemoAction } from "../../demo-login-actions";
import { messages } from "../../messages.fr";
import { ActionNotice, AdminShell } from "../competitions/admin-shell";
import { adminOnly } from "../guard";

const text = messages.demoLogin;

/**
 * Pre-production only (#637): the demo players, each with « Se connecter en tant que ». In
 * production (no PREPROD_DEMO_LOGIN) the page does not exist.
 */
export default async function DemoPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const enabled = demoLoginEnabled();
  if (!enabled) notFound();
  const { userId, client } = await adminOnly();
  let players: { userId: string; pseudo: string }[] | "error";
  try {
    players = await listDemoPlayers({
      enabled,
      profiles: createSupabaseProfileRepository(client),
      demo: createSupabaseDemoAccounts(createServiceRoleClient()),
    }).execute({ userId });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    players = "error";
  }
  const { erreur } = await searchParams;
  const error = erreur && erreur in messages.errors ? messages.errors[erreur as ErrorCode] : null;

  return (
    <AdminShell title={text.title} section="demoPlayers">
      <p className="text-sm text-muted-foreground">{text.intro}</p>
      <ActionNotice saved={false} error={error} />
      {players === "error" ? (
        <ErrorNotice
          retryHref="/admin/joueurs-demo"
          message={messages.errors.PLAYERS_UNAVAILABLE}
        />
      ) : players.length === 0 ? (
        <p className="rounded-2xl bg-muted px-3.5 py-3 text-sm">{text.empty}</p>
      ) : (
        <ul aria-label={text.listLabel} className="flex flex-col gap-2">
          {players.map((player) => (
            <li
              key={player.userId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-3.5 py-2"
            >
              <span className="min-w-0 break-words font-semibold">{player.pseudo}</span>
              <form action={signInAsDemoAction}>
                <input type="hidden" name="userId" value={player.userId} />
                <SubmitButton
                  pendingLabel={text.signingIn}
                  variant="outline"
                  className="px-4 text-sm"
                  ariaLabel={text.signInAsLabel(player.pseudo)}
                >
                  {text.signInAs}
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
