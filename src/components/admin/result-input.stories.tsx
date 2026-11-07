import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, within } from "storybook/test";

import { ResultInput, type ResultAthleteOption } from "./result-input";

const athletes: ResultAthleteOption[] = [
  { id: "a-shacarri", label: "🇺🇸 S. Richardson" },
  { id: "a-julien", label: "🇱🇨 J. Alfred" },
  { id: "a-marie", label: "🇨🇮 M-J. Ta Lou" },
  { id: "a-dina", label: "🇬🇧 D. Asher-Smith" },
];

const meta = {
  title: "Admin/ResultInput",
  component: ResultInput,
  args: { athletes },
  decorators: [
    (Story) => (
      <div className="w-80 bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ResultInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GoldFilled: Story = {
  args: { rank: 1, athleteId: "a-shacarri", mark: "10.78" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByDisplayValue("10.78")).toBeInTheDocument();
  },
};

export const SilverFilled: Story = {
  args: { rank: 2, athleteId: "a-julien", mark: "10.85" },
};

export const BronzeEmpty: Story = {
  args: { rank: 3 },
};

export const BronzeTied: Story = {
  args: { rank: 3, athleteId: "a-marie", mark: "10.91", tie: true },
};

function InteractiveResultInput(args: React.ComponentProps<typeof ResultInput>) {
  const [athleteId, setAthleteId] = useState<string | undefined>();
  const [mark, setMark] = useState<string>("");
  const [tie, setTie] = useState(false);
  return (
    <ResultInput
      {...args}
      athleteId={athleteId}
      mark={mark}
      tie={tie}
      onAthleteChange={setAthleteId}
      onMarkChange={setMark}
      onTieChange={setTie}
    />
  );
}

/** Full flow: edit athlete, mark, toggle tie — the parent owns the state. */
export const Interactive: Story = {
  args: { rank: 1 },
  render: InteractiveResultInput,
};
