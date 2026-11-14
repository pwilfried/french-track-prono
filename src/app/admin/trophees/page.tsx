import { UseCaseError } from "@/application/errors";
import { ErrorNotice } from "@/components/error-notice";
import { seasonOf } from "@/domain/trophies";
import { createSupabaseTrophyRepository } from "@/infra";

import { currentCompetitionDay, loadCompetitions } from "../../competition";
import { messages } from "../../messages.fr";
import { AdminShell } from "../competitions/admin-shell";
import { adminOnly } from "../guard";
import { AwardForm, WitnessForm } from "./trophy-forms";

const text = messages.adminTrophies;

/** The season trophies (#822): the FrenchTrack account of the Témoin d'or, and drawing them. */
export default async function AdminTrophiesPage() {
  const { client } = await adminOnly();
  let witness: string | null | "error";
  try {
    witness = await createSupabaseTrophyRepository(client).witness();
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    witness = "error";
  }
  const { coming, past } = await loadCompetitions();
  const current = seasonOf(currentCompetitionDay());
  const seasons = [
    ...new Set([current, ...[...coming, ...past].map((c) => seasonOf(c.endsOn))]),
  ].sort((a, b) => b - a);

  return (
    <AdminShell title={text.title} section="trophies">
      <p className="text-sm text-muted-foreground">{text.subtitle}</p>
      <section
        aria-labelledby="award"
        className="flex flex-col gap-2 rounded-card border border-border bg-card p-3"
      >
        <h2 id="award" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {text.awardTitle}
        </h2>
        <p className="text-sm">{text.awardHelp}</p>
        <AwardForm seasons={seasons} current={current} />
      </section>
      <section
        aria-labelledby="witness-title"
        className="flex flex-col gap-2 rounded-card border border-border bg-card p-3"
      >
        <h2
          id="witness-title"
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          {text.witnessTitle}
        </h2>
        <p className="text-sm">{text.witnessHelp}</p>
        {witness === "error" ? (
          <ErrorNotice retryHref="/admin/trophees" message={messages.errors.TROPHIES_UNAVAILABLE} />
        ) : (
          <WitnessForm pseudo={witness} />
        )}
      </section>
    </AdminShell>
  );
}
