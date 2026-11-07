import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import { ChipStatus } from "./chip-status";

const meta = {
  title: "UI/ChipStatus",
  component: ChipStatus,
  decorators: [
    (Story) => (
      <div className="flex flex-wrap items-center gap-2 bg-background p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChipStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Brand: Story = {
  args: { tone: "brand", children: "+ Prono" },
};

export const Ok: Story = {
  args: { tone: "ok", children: "✓ Posé" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Posé/)).toBeInTheDocument();
  },
};

export const Gold: Story = {
  args: { tone: "gold", children: "★ Phare" },
};

export const Hot: Story = {
  args: { tone: "hot", children: "⏱ -8 min" },
};

export const Ghost: Story = {
  args: { tone: "ghost", children: "À venir" },
};

export const AllTones: Story = {
  args: { children: "" },
  render: () => (
    <>
      <ChipStatus tone="brand">+ Prono</ChipStatus>
      <ChipStatus tone="ok">✓ Posé</ChipStatus>
      <ChipStatus tone="gold">★ Phare</ChipStatus>
      <ChipStatus tone="hot">⏱ -8 min</ChipStatus>
      <ChipStatus tone="ghost">À venir</ChipStatus>
      <ChipStatus tone="neutral">Fermé</ChipStatus>
    </>
  ),
};
