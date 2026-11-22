import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

import type { DisciplineFamily } from "@/domain/discipline";
import { teamBuild, type BuildRules } from "@/domain/manager-build";
import { MANAGER_FAMILIES, type ManagerSex } from "@/domain/manager-rules";

import { BidsRecap } from "./bids-recap";

const rules: BuildRules = {
  minTeamSize: 12,
  quotas: MANAGER_FAMILIES.map((family) => ({ family, min: 3, minPerSex: 1, maxPerSex: 4 })),
};
const won = (family: DisciplineFamily, sex: ManagerSex) => ({ family, sex });
const bid = (family: DisciplineFamily, sex: ManagerSex) => ({ family, sex, pending: true });

const meta = {
  title: "Manager/BidsRecap",
  component: BidsRecap,
  decorators: [
    (Story) => (
      <div className="w-[390px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BidsRecap>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No bid yet: every family at zero and a line to start. */
export const NoBid: Story = {
  args: { build: teamBuild(rules, [], 100), engaged: 0, budget: 100 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Aucune enchère pour l'instant/)).toBeVisible();
    await expect(canvas.getByText("Budget engagé : 0 / 100 cr.")).toBeVisible();
  },
};

/** Sprint reaches its minimum with a won athlete and two bids. */
export const FamilyComplete: Story = {
  args: {
    build: teamBuild(
      rules,
      [won("sprint", "F"), bid("sprint", "M"), bid("hurdles", "F"), bid("throws", "M")],
      60,
    ),
    engaged: 40,
    budget: 100,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByLabelText(/Sprint et haies : 1 gagné, 2 enchères en cours/),
    ).toBeVisible();
    await expect(canvas.getByText("3/3")).toBeVisible();
  },
};

/** The athletes and the bids together exceed the budget. */
export const OverBudget: Story = {
  args: {
    build: teamBuild(rules, [won("sprint", "F"), bid("sprint", "M")], 0),
    engaged: 120,
    budget: 100,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("alert")).toHaveTextContent(/Budget dépassé/);
  },
};
