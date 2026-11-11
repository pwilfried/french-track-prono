import { UseCaseError } from "@/application/errors";
import { listCompetitions } from "@/application/list-competitions";
import { getManagerRules } from "@/application/manager-rules";
import { ErrorNotice } from "@/components/error-notice";
import {
  createSupabaseCompetitionAdminRepository,
  createSupabaseManagerRuleRepository,
} from "@/infra";

import { currentDay } from "../../competition";
import { messages } from "../../messages.fr";
import { AdminShell } from "../competitions/admin-shell";
import { adminOnly } from "../guard";
import { ManagerRulesForm } from "./rules-form";

/** The general rules of French Track Manager (#418), set by the admin only. */
export default async function ManagerRulesPage() {
  const { client } = await adminOnly();
  let loaded;
  try {
    const [set, competitions] = await Promise.all([
      getManagerRules({ rules: createSupabaseManagerRuleRepository(client) }).execute(),
      listCompetitions({ competitions: createSupabaseCompetitionAdminRepository(client) }).execute({
        today: currentDay(),
      }),
    ]);
    // The coming competitions, and those already eligible even if they are over.
    const shown = [...competitions.coming, ...competitions.past].filter(
      (c) => competitions.coming.includes(c) || set.competitionSlugs.includes(c.slug),
    );
    loaded = {
      set,
      competitions: shown.map((c) => ({
        slug: c.slug,
        name: c.name,
        dates: messages.competition.dates(c.startsOn, c.endsOn),
      })),
    };
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    loaded = null;
  }

  return (
    <AdminShell title={messages.managerRules.title} section="manager">
      <p className="text-sm text-muted-foreground">{messages.managerRules.subtitle}</p>
      {loaded ? (
        <ManagerRulesForm initial={loaded.set} competitions={loaded.competitions} />
      ) : (
        <ErrorNotice
          retryHref="/admin/manager"
          message={messages.errors.MANAGER_RULES_UNAVAILABLE}
        />
      )}
    </AdminShell>
  );
}
