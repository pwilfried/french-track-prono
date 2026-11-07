import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { ChipStatus } from "@/components/ui/chip-status";

import { AdminBanner } from "./admin-banner";
import { ResultInput, type ResultAthleteOption } from "./result-input";

/**
 * Composed admin pages, assembled from the admin components + existing design system.
 * These are visual-only stories; no routing, no data fetch — props are inlined.
 */
const meta: Meta = {
  title: "Admin/Pages",
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj;

/** Shared chrome: a phone-ish frame with the admin banner + a status/app bar on top. */
function AdminShell({
  title,
  subtitle,
  view,
  back,
  children,
}: {
  title: string;
  subtitle?: string;
  view?: string;
  back?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col bg-background text-foreground">
      <AdminBanner adminName="p.wilfried" view={view} />
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        {back ? (
          <button className="text-sm font-semibold text-brand">{back}</button>
        ) : (
          <div className="min-w-0">
            <h1 className="font-display text-lg font-extrabold leading-tight tracking-tight">
              {title}
            </h1>
            {subtitle && <p className="font-mono text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        )}
        <div
          aria-label="Admin"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-primary bg-[color-mix(in_oklab,var(--color-primary)_14%,transparent)] text-sm font-extrabold text-accent-text"
        >
          PW
        </div>
      </header>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------
   A3 — Dashboard admin
--------------------------------------------------------------- */
export const Dashboard: Story = {
  render: () => (
    <AdminShell title="Tableau de bord" subtitle="2 compétitions actives">
      <section className="grid grid-cols-3 gap-2 px-4">
        {[
          ["142", "Joueurs"],
          ["28", "Épreuves"],
          ["89%", "Pronos"],
        ].map(([v, l]) => (
          <div key={l} className="rounded-xl bg-muted p-2 text-center">
            <div className="font-display text-xl font-extrabold leading-none text-foreground tabular-nums">
              {v}
            </div>
            <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {l}
            </div>
          </div>
        ))}
      </section>

      <h2 className="mt-4 px-4 font-display text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        Compétitions
      </h2>
      <div className="flex flex-col gap-2.5 px-4 pt-2">
        <article className="flex flex-col gap-2.5 rounded-xl bg-muted p-3.5">
          <header className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-[15px] font-extrabold leading-tight tracking-tight text-foreground">
                Ultimate Championship 2026
              </h3>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                Budapest · 11—13 sept.
              </p>
            </div>
            <ChipStatus tone="hot">
              <span className="relative pl-3">
                <span className="absolute left-0 top-1/2 size-1.5 -translate-y-1/2 animate-pulse rounded-full bg-white motion-reduce:animate-none" />
                Live
              </span>
            </ChipStatus>
          </header>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11.5px] font-semibold text-foreground/80">
              <span>Résultats saisis</span>
              <span className="font-mono text-foreground">18 / 28</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-gradient-to-r from-success to-primary"
                style={{ width: "64%" }}
              />
            </div>
          </div>
          <button className="min-h-11 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">
            ⚡ Lancer le calcul (10 épreuves)
          </button>
        </article>

        <article className="flex flex-col gap-2.5 rounded-xl bg-muted p-3.5">
          <header className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-[15px] font-extrabold tracking-tight text-foreground">
                Diamond League · Monaco
              </h3>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">11 juillet 2026</p>
            </div>
            <ChipStatus tone="ok">Terminé</ChipStatus>
          </header>
          <div className="flex justify-between text-[11.5px] font-semibold text-foreground/80">
            <span>Résultats</span>
            <span className="font-mono text-foreground">14 / 14</span>
          </div>
        </article>
      </div>
    </AdminShell>
  ),
};

/* ---------------------------------------------------------------
   A4 — Saisie liste de départ
--------------------------------------------------------------- */
const startlist = [
  { id: "a-shacarri", flag: "🇺🇸", name: "Sha'Carri Richardson", sb: "10.72", added: true },
  { id: "a-julien", flag: "🇱🇨", name: "Julien Alfred", sb: "10.72", added: true },
  { id: "a-sanya", flag: "🇺🇸", name: "Sanya Richards-Ross", sb: "10.95 (2008)", added: false },
  { id: "a-dina", flag: "🇬🇧", name: "Dina Asher-Smith", sb: "10.98", added: false },
];

export const Startlist: Story = {
  render: () => (
    <AdminShell title="" view="saisie startlist" back="← Épreuves">
      <div className="px-4 pt-1">
        <h1 className="font-display text-[22px] font-extrabold leading-tight tracking-tight text-foreground">
          100 m — Finale F
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">Ven. 11 sept. · 20:30 · lock 20:25</p>
      </div>

      <h2 className="mt-4 px-4 font-display text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        Chercher une athlète
      </h2>
      <label htmlFor="startlist-search" className="sr-only">
        Chercher une athlète
      </label>
      <div className="mx-4 flex min-h-11 items-center gap-2 rounded-xl border-[1.5px] border-border bg-muted px-3.5 py-3 text-sm text-muted-foreground">
        <span aria-hidden="true">🔎</span>
        <input
          id="startlist-search"
          defaultValue="richard"
          className="flex-1 bg-transparent font-semibold text-foreground outline-none"
        />
        <span className="ml-auto text-xs text-muted-foreground">3 résultats</span>
      </div>

      <h2 className="mt-4 px-4 font-display text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        Engagées · 4 / 8 max
      </h2>
      <ul className="flex flex-col gap-1.5 px-4">
        {startlist.map((a) => (
          <li
            key={a.id}
            className={`grid min-h-13 grid-cols-[24px_1fr_auto] items-center gap-3 rounded-xl p-2.5 ${
              a.added ? "border-[1.5px] border-primary bg-primary-soft" : "bg-muted"
            }`}
          >
            <span className="text-center text-xl" aria-hidden="true">
              {a.flag}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-semibold text-foreground">{a.name}</div>
              {a.added ? (
                <div className="mt-0.5 inline-block rounded border border-dashed border-primary bg-background px-2 py-0.5 font-mono text-xs font-bold text-primary-ink">
                  {a.sb}
                </div>
              ) : (
                <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">RS {a.sb}</div>
              )}
            </div>
            <button
              type="button"
              className={`min-h-9 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                a.added ? "bg-accent-soft text-accent-ink" : "bg-primary text-primary-foreground"
              }`}
            >
              {a.added ? "Retirer" : "+ Ajouter"}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex gap-2 px-4 pb-4">
        <button className="flex-1 min-h-12 rounded-xl border-[1.5px] border-brand text-sm font-bold text-brand">
          Annuler
        </button>
        <button className="flex-[1.4] min-h-12 rounded-xl bg-primary text-sm font-bold text-primary-foreground">
          Enregistrer
        </button>
      </div>
    </AdminShell>
  ),
};

/* ---------------------------------------------------------------
   A5 — Saisie podium officiel (interactive)
--------------------------------------------------------------- */
const podiumAthletes: ResultAthleteOption[] = [
  { id: "a-shacarri", label: "🇺🇸 S. Richardson" },
  { id: "a-julien", label: "🇱🇨 J. Alfred" },
  { id: "a-marie", label: "🇨🇮 M-J. Ta Lou" },
  { id: "a-dina", label: "🇬🇧 D. Asher-Smith" },
];

type SlotState = { athleteId?: string; mark: string; tie: boolean };

export const PodiumSaisie: Story = {
  render: () => {
    const [slots, setSlots] = useState<[SlotState, SlotState, SlotState]>([
      { athleteId: "a-shacarri", mark: "10.78", tie: false },
      { athleteId: "a-julien", mark: "10.85", tie: false },
      { athleteId: undefined, mark: "", tie: true },
    ]);
    const update = (i: 0 | 1 | 2, patch: Partial<SlotState>) =>
      setSlots((s) => {
        const next = [...s] as typeof s;
        next[i] = { ...next[i], ...patch };
        return next;
      });

    return (
      <AdminShell title="" view="saisie résultat" back="← Épreuves">
        <div className="px-4 pt-1">
          <h1 className="font-display text-[22px] font-extrabold leading-tight tracking-tight text-foreground">
            100 m F — Podium officiel
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Déclenche le calcul des points pour 142 joueurs
          </p>
        </div>

        <h2 className="mt-4 px-4 font-display text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          3 marches
        </h2>
        <div className="flex flex-col gap-2 px-4">
          {([1, 2, 3] as const).map((rank, i) => (
            <ResultInput
              key={rank}
              rank={rank}
              athletes={podiumAthletes}
              athleteId={slots[i].athleteId}
              mark={slots[i].mark}
              tie={slots[i].tie}
              onAthleteChange={(athleteId) => update(i as 0 | 1 | 2, { athleteId })}
              onMarkChange={(mark) => update(i as 0 | 1 | 2, { mark })}
              onTieChange={(tie) => update(i as 0 | 1 | 2, { tie })}
            />
          ))}
        </div>

        {slots.some((s) => s.tie) && (
          <aside className="mx-4 mt-2.5 flex items-start gap-2.5 rounded-xl bg-secondary/40 p-3 text-xs text-foreground">
            <span aria-hidden="true" className="text-base leading-none">
              ⚠️
            </span>
            <div>
              <strong className="block text-[13px] font-extrabold">Ex æquo détecté</strong>
              <span>
                Au clic suivant, tu pourras saisir deux athlètes avec le même chrono sur ce rang.
              </span>
            </div>
          </aside>
        )}

        <div className="mt-4 flex gap-2 px-4 pb-4">
          <button className="flex-1 min-h-12 rounded-xl border-[1.5px] border-brand text-sm font-bold text-brand">
            Brouillon
          </button>
          <button className="flex-[1.4] min-h-12 rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            Valider le podium
          </button>
        </div>
      </AdminShell>
    );
  },
};

/* ---------------------------------------------------------------
   A6 — Lancement du calcul (dry-run / write)
--------------------------------------------------------------- */
export const ScoringRun: Story = {
  render: () => {
    const [mode, setMode] = useState<"dry" | "write">("dry");
    return (
      <AdminShell title="" view="scoring run" back="← Dashboard">
        <div className="px-4 pt-1">
          <h1 className="font-display text-[22px] font-extrabold leading-tight tracking-tight text-foreground">
            Calcul des points
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">Ultimate Championship 2026</p>
        </div>

        <section className="mx-4 mt-3 flex flex-col gap-2 rounded-xl bg-muted p-3.5">
          {[
            ["Épreuves à calculer", "10"],
            ["Déjà calculées (skip)", "8"],
            ["Joueurs concernés", "142"],
            ["Pronos en entrée", "1 384"],
            ["Lignes score_events estimées", "~ 1 800"],
          ].map(([l, v]) => (
            <div key={l} className="flex items-center justify-between text-[13px]">
              <span className="font-medium text-foreground/85">{l}</span>
              <span className="font-mono font-bold tabular-nums text-foreground">{v}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t-2 border-foreground pt-2.5 text-[14.5px]">
            <span className="font-display font-extrabold text-foreground">Durée estimée</span>
            <span className="font-mono font-bold text-success-text">≈ 3 s</span>
          </div>
        </section>

        <aside className="mx-4 mt-2.5 flex items-start gap-2.5 rounded-xl bg-secondary/40 p-3 text-xs text-foreground">
          <span aria-hidden="true" className="text-base leading-none">
            💡
          </span>
          <div>
            <strong className="block text-[13px] font-extrabold">Idempotent</strong>
            <span>
              Relancer n'écrit pas deux fois : le même prono garde la même ligne (contrainte{" "}
              <code className="font-mono text-[11px]">one_score_per_prediction</code>).
            </span>
          </div>
        </aside>

        <h2 className="mt-4 px-4 font-display text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Mode
        </h2>
        <fieldset className="flex flex-col gap-2 px-4">
          <legend className="sr-only">Mode de calcul</legend>
          {(
            [
              ["dry", "Dry-run (simulation)", "N'écrit rien, affiche le résumé"],
              ["write", "Écrire en base", "Insère dans score_events (service_role)"],
            ] as const
          ).map(([value, label, help]) => (
            <label
              key={value}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-muted p-3"
            >
              <input
                type="radio"
                name="scoring-mode"
                value={value}
                checked={mode === value}
                onChange={() => setMode(value)}
                className="size-4 shrink-0 accent-primary"
              />
              <span className="flex-1">
                <span className="block text-[13px] font-bold text-foreground">{label}</span>
                <span className="block text-[11px] text-muted-foreground">{help}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="mt-4 px-4 pb-4">
          <button className="min-h-12 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            ⚡ Lancer le calcul ({mode === "dry" ? "simulation" : "en base"})
          </button>
        </div>
      </AdminShell>
    );
  },
};
