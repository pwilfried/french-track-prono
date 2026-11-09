import { getAdminTodo, type AdminTodo } from "@/application/admin-todo";
import {
  getCompetitionReadiness,
  type CompetitionReadiness,
} from "@/application/competition-readiness";
import { listAdminActions, type AdminAction } from "@/application/list-admin-actions";
import { listAdminPlayers } from "@/application/player-moderation";
import { playerStats } from "@/domain/admin-dashboard";
import {
  createPublicSupabaseClient,
  createSupabaseAdminLogRepository,
  createSupabaseClubAdminRepository,
  createSupabaseEventReader,
  createSupabaseLeagueModerationRepository,
  createSupabasePlayerModerationRepository,
  createSupabasePointsRepository,
  createSupabaseProfileRepository,
  createSupabaseReadinessReader,
} from "@/infra";

import { currentCompetition } from "../../competition";
import { messages } from "../../messages.fr";
import { AdminShell } from "../competitions/admin-shell";
import { adminOnly } from "../guard";
import { DashboardView } from "./dashboard-view";

const text = messages.adminDashboard;
const DAY = 24 * 60 * 60 * 1000;

/** A failed block shows a dash instead of breaking the whole page. */
async function orNull<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

/** Back-office home (#379): what is left to do, the players, the next competition, the log. */
export default async function AdminDashboardPage() {
  const { client, userId } = await adminOnly();
  const competition = await currentCompetition();
  const now = new Date();
  const [profile, todo, readiness, players, log] = await Promise.all([
    orNull(() => createSupabaseProfileRepository(client).find(userId)),
    orNull<AdminTodo>(() =>
      getAdminTodo({
        events: createSupabaseEventReader(createPublicSupabaseClient()),
        points: createSupabasePointsRepository(client),
        clubs: createSupabaseClubAdminRepository(client),
        moderation: createSupabaseLeagueModerationRepository(client),
      }).execute({ competitionSlug: competition.slug, now }),
    ),
    orNull<CompetitionReadiness>(() =>
      getCompetitionReadiness({
        events: createSupabaseEventReader(createPublicSupabaseClient()),
        readiness: createSupabaseReadinessReader(createPublicSupabaseClient()),
      }).execute({ competitionSlug: competition.slug, now }),
    ),
    orNull(() =>
      listAdminPlayers({ players: createSupabasePlayerModerationRepository(client) }).execute(),
    ),
    orNull(() =>
      listAdminActions({ log: createSupabaseAdminLogRepository(client) }).execute({ filter: {} }),
    ),
  ]);
  const stats = players ? playerStats(players, now) : null;
  const daysLeft = Math.ceil(
    (Date.parse(`${competition.startsOn}T00:00:00Z`) - now.getTime()) / DAY,
  );
  const recent: AdminAction[] = log?.actions.slice(0, 5) ?? [];

  return (
    <AdminShell title={text.title(profile?.pseudo ?? "")} section="dashboard" wide>
      <DashboardView
        competition={competition}
        daysLeft={daysLeft}
        todo={todo}
        readiness={readiness}
        stats={stats}
        recent={recent}
      />
    </AdminShell>
  );
}
