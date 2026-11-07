import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { RoundsCollapsible, type RoundResults } from "../events/rounds-collapsible";

/**
 * Planche 08 — "Composer son podium" variant with the previous rounds panel
 * (v0.6, issue #C1). Shown on finals only, since only finals are prognosticated.
 * The panel sits above the start list so the player can glance at semis/heats
 * before picking a podium.
 */
const meta: Meta = {
  title: "Screens/EventWithRounds",
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj;

const sampleRounds: RoundResults[] = [
  {
    label: "Demi-finales",
    when: "Jeu. 11 sept. · 19:45",
    athletes: [
      { athleteId: "sr", flag: "🇺🇸", name: "S. Richardson", mark: "10.78", qualifier: "Q" },
      { athleteId: "ja", flag: "🇱🇨", name: "J. Alfred", mark: "10.82", qualifier: "Q" },
      { athleteId: "tl", flag: "🇨🇮", name: "M-J. Ta Lou", mark: "10.89", qualifier: "q" },
      { athleteId: "as", flag: "🇬🇧", name: "D. Asher-Smith", mark: "10.95" },
    ],
  },
  {
    label: "Séries",
    when: "Jeu. 11 sept. · 18:30",
    athletes: [
      { athleteId: "sr", flag: "🇺🇸", name: "S. Richardson", mark: "10.86" },
      { athleteId: "ja", flag: "🇱🇨", name: "J. Alfred", mark: "10.91" },
      { athleteId: "tl", flag: "🇨🇮", name: "M-J. Ta Lou", mark: "10.94" },
    ],
  },
];

function EventWithRoundsScreen({
  defaultOpen = true,
  rounds = sampleRounds,
}: {
  defaultOpen?: boolean;
  rounds?: RoundResults[];
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <button className="text-sm font-semibold text-brand">← Épreuves</button>
        <div className="size-9" />
      </header>

      <div className="px-4 pt-1">
        <h1 className="font-display text-[24px] font-extrabold leading-tight tracking-tight text-foreground">
          100 m — Finale
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">Femmes · Ven. 11 sept. · 20:30</p>
      </div>

      <div className="mx-4 mt-3 flex items-center justify-between rounded-xl bg-primary px-3.5 py-2.5 text-xs font-bold text-primary-foreground">
        <span>⏱ Verrouillage dans</span>
        <span className="font-mono text-sm tabular-nums">00:42:04</span>
      </div>

      <div className="mt-3 px-0">
        <div className="px-4">
          <RoundsCollapsible rounds={rounds} defaultOpen={defaultOpen} />
        </div>
      </div>

      <h2 className="mt-4 px-4 font-display text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        Mon podium
      </h2>
      <div className="grid grid-cols-3 gap-2 px-4">
        <div className="flex aspect-[1/1.15] flex-col items-center justify-end gap-1 rounded-xl bg-gradient-to-b from-[#e6e8eb] to-[#a9aeb5] p-2.5 text-center font-display text-[#1b1f26]">
          <span className="text-xl font-extrabold leading-none">2</span>
          <span aria-hidden="true" className="text-lg">
            🇱🇨
          </span>
          <span className="font-sans text-[11.5px] font-bold leading-tight">J. Alfred</span>
        </div>
        <div className="flex aspect-[1/1.15] flex-col items-center justify-end gap-1 rounded-xl bg-gradient-to-b from-[#f7d672] to-[#d99a22] p-2.5 text-center font-display text-[#3a2a05]">
          <span className="text-xl font-extrabold leading-none">1</span>
          <span aria-hidden="true" className="text-lg">
            🇺🇸
          </span>
          <span className="font-sans text-[11.5px] font-bold leading-tight">S. Richardson</span>
        </div>
        <div className="flex aspect-[1/1.15] flex-col items-center justify-between rounded-xl border-2 border-dashed border-muted-foreground bg-muted p-2.5 text-center font-sans text-foreground/80">
          <span className="font-display text-xl font-extrabold leading-none">3</span>
          <span className="text-[11.5px] font-semibold">Tape une athlète</span>
        </div>
      </div>

      <div className="mt-4 px-4 pb-4">
        <button className="min-h-12 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground">
          Verrouiller mon podium
        </button>
      </div>
    </div>
  );
}

export const WithRoundsOpen: Story = {
  render: () => <EventWithRoundsScreen defaultOpen />,
};

export const WithRoundsCollapsed: Story = {
  render: () => <EventWithRoundsScreen defaultOpen={false} />,
};

/** Only semis (first-day event): the panel hides the heats row. */
export const SemisOnly: Story = {
  render: () => <EventWithRoundsScreen defaultOpen rounds={[sampleRounds[0]!]} />,
};
