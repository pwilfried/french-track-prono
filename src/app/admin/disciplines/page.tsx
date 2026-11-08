import { listDisciplines } from "@/application/disciplines";
import { UseCaseError } from "@/application/errors";
import { ErrorNotice } from "@/components/error-notice";
import type { Discipline } from "@/domain/discipline";
import { createSupabaseDisciplineRepository } from "@/infra";

import { messages } from "../../messages.fr";
import { AdminShell } from "../competitions/admin-shell";
import { adminOnly } from "../guard";
import { ToleranceForm } from "./tolerance-form";

export default async function DisciplinesPage() {
  const { client } = await adminOnly();
  let disciplines: Discipline[] | "error";
  try {
    disciplines = await listDisciplines({
      disciplines: createSupabaseDisciplineRepository(client),
    }).execute();
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    disciplines = "error";
  }
  const families = disciplines === "error" ? [] : [...new Set(disciplines.map((d) => d.family))];

  return (
    <AdminShell title={messages.disciplines.title} section="disciplines">
      <p className="text-sm text-muted-foreground">{messages.disciplines.subtitle}</p>
      {disciplines === "error" ? (
        <ErrorNotice
          retryHref="/admin/disciplines"
          message={messages.errors.DISCIPLINES_UNAVAILABLE}
        />
      ) : (
        families.map((family) => (
          <section
            key={family}
            aria-labelledby={`family-${family}`}
            className="flex flex-col gap-2"
          >
            <h2
              id={`family-${family}`}
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              {messages.disciplines.family[family]}
            </h2>
            <ul className="flex flex-col gap-2">
              {disciplines
                .filter((d) => d.family === family)
                .map((d) => (
                  <li key={d.name} className="rounded-card border border-border bg-card p-3">
                    <p className="font-bold">{d.name}</p>
                    <p className="mb-2 text-xs text-muted-foreground">
                      {d.lowerIsBetter
                        ? messages.disciplines.direction.lower
                        : messages.disciplines.direction.higher}
                    </p>
                    <ToleranceForm name={d.name} unit={d.unit} tolerance={d.tolerance} />
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </AdminShell>
  );
}
