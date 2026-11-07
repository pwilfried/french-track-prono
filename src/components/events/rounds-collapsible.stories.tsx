import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { RoundsCollapsible, type RoundResults } from "./rounds-collapsible";

const semis: RoundResults = {
  label: "Demi-finales",
  when: "Jeu. 11 sept. · 19:45",
  athletes: [
    { athleteId: "sr", flag: "🇺🇸", name: "S. Richardson", mark: "10.78", qualifier: "Q" },
    { athleteId: "ja", flag: "🇱🇨", name: "J. Alfred", mark: "10.82", qualifier: "Q" },
    { athleteId: "tl", flag: "🇨🇮", name: "M-J. Ta Lou", mark: "10.89", qualifier: "q" },
    { athleteId: "as", flag: "🇬🇧", name: "D. Asher-Smith", mark: "10.95" },
  ],
};

const heats: RoundResults = {
  label: "Séries",
  when: "Jeu. 11 sept. · 18:30",
  athletes: [
    { athleteId: "sr", flag: "🇺🇸", name: "S. Richardson", mark: "10.86" },
    { athleteId: "ja", flag: "🇱🇨", name: "J. Alfred", mark: "10.91" },
    { athleteId: "tl", flag: "🇨🇮", name: "M-J. Ta Lou", mark: "10.94" },
  ],
};

const meta = {
  title: "Events/RoundsCollapsible",
  component: RoundsCollapsible,
  decorators: [
    (Story) => (
      <div className="max-w-sm bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RoundsCollapsible>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CollapsedByDefault: Story = {
  args: { rounds: [semis, heats] },
};

export const OpenWithTwoRounds: Story = {
  args: { rounds: [semis, heats], defaultOpen: true },
};

export const OnlySemis: Story = {
  args: { rounds: [semis], defaultOpen: true },
};

/** Empty rounds array: component renders nothing (returns null). */
export const Empty: Story = {
  args: { rounds: [] },
};
