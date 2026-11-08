import { UseCaseError } from "@/application/errors";
import { listReportedLeagues, type ReportedLeague } from "@/application/league-moderation";
import { ErrorNotice } from "@/components/error-notice";
import { createSupabaseLeagueModerationRepository } from "@/infra";

import { messages } from "../../messages.fr";
import { AdminShell } from "../competitions/admin-shell";
import { adminOnly } from "../guard";
import { DeleteLeagueForm, RenameLeagueForm } from "./moderation-forms";

const text = messages.moderation;

/** The public leagues reported by players (#321): the admin renames or deletes them. */
export default async function ReportedLeaguesPage() {
  const { client } = await adminOnly();
  let leagues: ReportedLeague[] | "error";
  try {
    leagues = await listReportedLeagues({
      moderation: createSupabaseLeagueModerationRepository(client),
    }).execute();
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    leagues = "error";
  }

  return (
    <AdminShell title={text.title} section="leagues">
      <p className="text-sm text-muted-foreground">{text.subtitle}</p>
      {leagues === "error" ? (
        <ErrorNotice retryHref="/admin/ligues" message={messages.errors.LEAGUES_UNAVAILABLE} />
      ) : leagues.length === 0 ? (
        <p className="rounded-card bg-muted p-4 text-sm text-muted-foreground">{text.empty}</p>
      ) : (
        <ul aria-label={text.title} className="flex flex-col gap-3">
          {leagues.map((league) => (
            <li
              key={league.id}
              className="flex flex-col gap-3 rounded-card border border-border bg-card p-3.5"
            >
              <div>
                <p className="break-words font-extrabold">{league.name}</p>
                <p className="text-sm text-muted-foreground">
                  {text.reports(league.reportCount)} · {text.members(league.memberCount)}
                </p>
              </div>
              <RenameLeagueForm leagueId={league.id} name={league.name} />
              <DeleteLeagueForm leagueId={league.id} />
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
