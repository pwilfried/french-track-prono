import { UseCaseError } from "@/application/errors";
import { listAdminLeagues, type AdminLeague } from "@/application/league-moderation";
import { listMomentReports, type MomentReport } from "@/application/moment-reactions";
import { ErrorNotice } from "@/components/error-notice";
import { TIME_ZONE } from "@/domain/competition";
import {
  createSupabaseLeagueModerationRepository,
  createSupabaseMomentReactionRepository,
} from "@/infra";

import { messages } from "../../messages.fr";
import { AdminShell } from "../competitions/admin-shell";
import { adminOnly } from "../guard";
import { FeedReports } from "./feed-reports";
import { LeaguesAdmin, type LeagueRow } from "./leagues-admin";

const text = messages.adminLeagues;
const day = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});

/**
 * Back-office « Ligues » (#321, #383): every league, the reported ones first; above them, the
 * reported reactions and messages of the feeds (#672).
 */
export default async function AdminLeaguesPage() {
  const { client } = await adminOnly();
  let leagues: AdminLeague[] | "error";
  try {
    leagues = await listAdminLeagues({
      moderation: createSupabaseLeagueModerationRepository(client),
    }).execute();
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    leagues = "error";
  }
  let feedReports: MomentReport[] | "error";
  try {
    feedReports = await listMomentReports({
      reactions: createSupabaseMomentReactionRepository(client),
    }).execute();
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    feedReports = "error";
  }
  const rows: LeagueRow[] =
    leagues === "error"
      ? []
      : leagues.map((league) => ({
          ...league,
          createdLabel: day.format(new Date(league.createdAt)),
        }));

  return (
    <AdminShell title={text.title} section="leagues" wide>
      <p className="text-sm text-muted-foreground">
        {leagues === "error"
          ? text.subtitle
          : text.summary(
              rows.length,
              rows.filter((l) => l.isPublic).length,
              rows.filter((l) => l.reportCount > 0).length,
            )}
      </p>
      {feedReports === "error" ? (
        <ErrorNotice retryHref="/admin/ligues" message={messages.errors.LEAGUES_UNAVAILABLE} />
      ) : (
        <FeedReports reports={feedReports} />
      )}
      {leagues === "error" ? (
        <ErrorNotice retryHref="/admin/ligues" message={messages.errors.LEAGUES_UNAVAILABLE} />
      ) : (
        <LeaguesAdmin leagues={rows} />
      )}
    </AdminShell>
  );
}
