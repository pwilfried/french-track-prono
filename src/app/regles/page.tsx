import type { Metadata } from "next";

import { listDisciplines } from "@/application/disciplines";
import { UseCaseError } from "@/application/errors";
import { RulesSection, ScaleRules } from "@/components/rules/scale-rules";
import type { Discipline } from "@/domain/discipline";

import { messages } from "../messages.fr";
import { loadScale } from "../scale";
import { publicDisciplines } from "../public-data";

export const metadata: Metadata = { title: messages.rules.title };

async function loadTolerances(): Promise<Discipline[]> {
  try {
    const all = await listDisciplines({
      disciplines: publicDisciplines(),
    }).execute();
    const examples = ["100 m", "400 m", "Saut en longueur", "Saut en hauteur", "Lancer du javelot"];
    return all.filter((d) => examples.includes(d.name));
  } catch (error) {
    if (error instanceof UseCaseError) return [];
    throw error;
  }
}

/** « Comment jouer » (#263): the rules with the current scale and worked examples, then a FAQ. */
export default async function RulesPage() {
  const [scale, tolerances] = await Promise.all([loadScale(), loadTolerances()]);
  const t = messages.rules;

  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6 leading-relaxed"
    >
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-extrabold leading-tight">{t.title}</h1>
        <p className="text-muted-foreground">{t.intro}</p>
      </div>

      <ScaleRules scale={scale} tolerances={tolerances} />

      <RulesSection id="lock" title={t.lockTitle}>
        <p>{t.lock}</p>
      </RulesSection>

      <RulesSection id="faq" title={t.faqTitle}>
        <div className="flex flex-col gap-2">
          {t.faq.map((item) => (
            <details key={item.q} className="rounded-2xl border border-border bg-card px-3.5 py-2">
              <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
                {item.q}
              </summary>
              <p className="pb-2 text-sm text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </RulesSection>
    </main>
  );
}
