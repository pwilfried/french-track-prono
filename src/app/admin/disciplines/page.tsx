import Link from "next/link";

import { listDisciplines } from "@/application/disciplines";
import { UseCaseError } from "@/application/errors";
import { ErrorNotice } from "@/components/error-notice";
import type { Discipline } from "@/domain/discipline";
import { createSupabaseDisciplineRepository } from "@/infra";

import { messages } from "../../messages.fr";
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
    <main id="main" className="flex flex-1 flex-col">
      <p
        role="note"
        className="bg-primary px-4 py-1 text-center text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary-foreground"
      >
        {messages.admin.band}
      </p>
      <header className="px-4 pt-4">
        <div className="mx-auto max-w-md">
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center font-semibold text-brand dark:text-secondary"
          >
            ‹ {messages.admin.back}
          </Link>
          <h1 className="mt-1 font-display text-3xl font-extrabold leading-none">
            {messages.disciplines.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{messages.disciplines.subtitle}</p>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-5">
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
      </div>
    </main>
  );
}
