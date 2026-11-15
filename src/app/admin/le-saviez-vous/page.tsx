import { listDisciplines } from "@/application/disciplines";
import { UseCaseError } from "@/application/errors";
import { listFunFactsForAdmin, type AdminFunFact } from "@/application/fun-facts";
import { ErrorNotice } from "@/components/error-notice";
import { createSupabaseDisciplineRepository, createSupabaseFunFactRepository } from "@/infra";

import { loadCompetitions } from "../../competition";
import { messages } from "../../messages.fr";
import { AdminShell } from "../competitions/admin-shell";
import { adminOnly } from "../guard";
import { DeleteFunFactForm, EnabledForm, FunFactForm } from "./fun-fact-forms";

const text = messages.adminFunFacts;
const box = "flex flex-col gap-2 rounded-card border border-border bg-card p-3";
const heading = "text-xs font-bold uppercase tracking-wider text-muted-foreground";

/** « Le saviez-vous ? » (#766): the switch of the card and the bank of facts, with their sources. */
export default async function AdminFunFactsPage() {
  const { client } = await adminOnly();
  let bank: { enabled: boolean; facts: AdminFunFact[] } | "error";
  try {
    bank = await listFunFactsForAdmin({ facts: createSupabaseFunFactRepository(client) }).execute();
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    bank = "error";
  }
  const [{ coming, past }, disciplines] = await Promise.all([
    loadCompetitions(),
    listDisciplines({ disciplines: createSupabaseDisciplineRepository(client) })
      .execute()
      .catch((error: unknown) => {
        if (error instanceof UseCaseError) return [];
        throw error;
      }),
  ]);
  const choices = {
    competitions: [...coming, ...past].map((c) => ({ slug: c.slug, name: c.name })),
    disciplines: disciplines.map((d) => d.name),
  };

  return (
    <AdminShell title={text.heading} section="funFacts">
      <p className="text-sm text-muted-foreground">{text.subtitle}</p>
      {bank === "error" ? (
        <ErrorNotice
          retryHref="/admin/le-saviez-vous"
          message={messages.errors.FUN_FACTS_UNAVAILABLE}
        />
      ) : (
        <>
          <section aria-labelledby="fun-facts-switch" className={box}>
            <h2 id="fun-facts-switch" className={heading}>
              {text.switchTitle}
            </h2>
            <EnabledForm enabled={bank.enabled} />
          </section>
          <section aria-labelledby="fun-facts-add" className={box}>
            <h2 id="fun-facts-add" className={heading}>
              {text.addTitle}
            </h2>
            <FunFactForm {...choices} />
          </section>
          <section aria-labelledby="fun-facts-bank" className="flex flex-col gap-2">
            <h2 id="fun-facts-bank" className={heading}>
              {text.bank(bank.facts.length)}
            </h2>
            {bank.facts.length === 0 ? (
              <p className="text-sm">{text.empty}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {bank.facts.map((fact) => (
                  <li key={fact.id} className="rounded-card border border-border bg-card">
                    <details>
                      <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2 p-3">
                        <span className="font-bold [overflow-wrap:anywhere]">{fact.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {messages.funFacts.tag[fact.tag]}
                        </span>
                        {!fact.active && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                            {text.disabled}
                          </span>
                        )}
                      </summary>
                      <div className="flex flex-col gap-3 px-3 pb-3">
                        <FunFactForm fact={fact} {...choices} />
                        <DeleteFunFactForm id={fact.id} title={fact.title} />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </AdminShell>
  );
}
